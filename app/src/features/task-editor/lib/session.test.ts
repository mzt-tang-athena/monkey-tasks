import { describe, expect, it } from "vitest";
import type { TaskEdit } from "@/types/task";
import {
  EMPTY_EDITOR,
  reduce,
  type EditorEvent,
  type EditorState,
  type WriteJob,
} from "./session";

const OPENED = "file v1";

function draft(overrides: Partial<TaskEdit> = {}): TaskEdit {
  return {
    name: "Call Mum",
    due: null,
    recurrence: null,
    list: null,
    reminders: [],
    alertWeight: "harsh",
    body: "",
    ...overrides,
  };
}

/** Run events in order and collect every write the editor starts. */
function run(events: EditorEvent[], from: EditorState = EMPTY_EDITOR) {
  let state = from;
  const jobs: WriteJob[] = [];
  for (const event of events) {
    const result = reduce(state, event);
    state = result.state;
    if (result.job != null) {
      jobs.push(result.job.job);
    }
  }
  return { state, jobs };
}

const open: EditorEvent = { type: "open", id: "a", draft: draft(), base: OPENED };
const change = (patch: Partial<TaskEdit>): EditorEvent => ({
  type: "session",
  id: "a",
  event: { type: "change", patch },
});
const written = (edit: TaskEdit, text: string): EditorEvent => ({
  type: "session",
  id: "a",
  event: { type: "written", edit, text },
});
const failed = (message: string): EditorEvent => ({
  type: "session",
  id: "a",
  event: { type: "failed", message },
});

describe("the editor's write queue", () => {
  it("writes a change at once, against the text the task opened with", () => {
    const { state, jobs } = run([open, change({ due: "2026-10-27" })]);

    expect(jobs).toEqual([
      { edit: draft({ due: "2026-10-27" }), expected: OPENED },
    ]);
    expect(state.sessions.a?.write).toEqual({ kind: "writing" });
  });

  it("writes a change of the alert weight alone", () => {
    const { jobs } = run([open, change({ alertWeight: "quiet" })]);

    expect(jobs).toEqual([
      { edit: draft({ alertWeight: "quiet" }), expected: OPENED },
    ]);
  });

  it("starts no write for a change that changes nothing", () => {
    const { jobs } = run([open, change({ due: null, name: "Call Mum" })]);

    expect(jobs).toEqual([]);
  });

  it("holds later changes behind the write in flight and sends only the last", () => {
    const first = draft({ due: "2026-10-27" });
    const { state, jobs } = run([
      open,
      change({ due: "2026-10-27" }),
      change({ due: "2026-10-28" }),
      change({ list: "Focus" }),
      written(first, "file v2"),
    ]);

    // Two writes, not three: the queued changes go as one, built on the
    // text the first write left.
    expect(jobs).toEqual([
      { edit: first, expected: OPENED },
      { edit: draft({ due: "2026-10-28", list: "Focus" }), expected: "file v2" },
    ]);
    expect(state.sessions.a?.write).toEqual({ kind: "writing" });
  });

  it("goes idle and keeps the written text as the next base", () => {
    const edit = draft({ due: "2026-10-27" });
    const { state, jobs } = run([
      open,
      change({ due: "2026-10-27" }),
      written(edit, "file v2"),
      change({ due: "2026-10-29" }),
    ]);

    expect(jobs[1]).toEqual({
      edit: draft({ due: "2026-10-29" }),
      expected: "file v2",
    });
    expect(state.sessions.a?.base).toBe("file v2");
  });

  it("starts no second write when the queued draft equals the one written", () => {
    const edit = draft({ due: "2026-10-27" });
    const { state, jobs } = run([
      open,
      change({ due: "2026-10-27" }),
      change({ due: "2026-10-28" }),
      change({ due: "2026-10-27" }),
      written(edit, "file v2"),
    ]);

    expect(jobs).toHaveLength(1);
    expect(state.sessions.a?.write).toEqual({ kind: "idle" });
  });

  it("keeps the new value on screen when a write fails", () => {
    const { state } = run([
      open,
      change({ due: "2026-10-27" }),
      failed("disk full"),
    ]);

    expect(state.sessions.a?.draft.due).toBe("2026-10-27");
    expect(state.sessions.a?.write).toEqual({
      kind: "failed",
      message: "disk full",
    });
  });

  it("retries the current draft against the latest text it is given", () => {
    const { state, jobs } = run([
      open,
      change({ due: "2026-10-27" }),
      failed("disk full"),
      change({ list: "Focus" }),
      failed("disk full"),
      { type: "session", id: "a", event: { type: "retry", base: "file v3" } },
    ]);

    expect(jobs.at(-1)).toEqual({
      edit: draft({ due: "2026-10-27", list: "Focus" }),
      expected: "file v3",
    });
    expect(state.sessions.a?.write).toEqual({ kind: "writing" });
  });

  it("ignores a retry when nothing failed", () => {
    const { jobs } = run([
      open,
      { type: "session", id: "a", event: { type: "retry", base: "x" } },
    ]);

    expect(jobs).toEqual([]);
  });
});

describe("the editor's sessions", () => {
  it("keeps a closed task while its write runs, then forgets it", () => {
    const edit = draft({ due: "2026-10-27" });
    const closed = run([open, change({ due: "2026-10-27" }), { type: "close" }]);
    expect(closed.state.openId).toBeNull();
    expect(closed.state.sessions.a).toBeDefined();

    const landed = run([written(edit, "file v2")], closed.state);
    expect(landed.state.sessions.a).toBeUndefined();
  });

  it("keeps a queued draft when the task closes behind the write in flight", () => {
    // The first write lands after the close. The queued draft still goes
    // next, so a title typed and closed at once is never lost.
    const first = draft({ due: "2026-10-27" });
    const closed = run([
      open,
      change({ due: "2026-10-27" }),
      change({ name: "Call Mum about Sunday" }),
      { type: "close" },
    ]);
    expect(closed.state.sessions.a).toBeDefined();

    const landed = run([written(first, "file v2")], closed.state);
    const queued = {
      edit: draft({ due: "2026-10-27", name: "Call Mum about Sunday" }),
      expected: "file v2",
    };
    expect(landed.jobs).toEqual([queued]);
    expect(landed.state.sessions.a).toBeDefined();

    // The queued write lands, and the task is then forgotten.
    const done = run([written(queued.edit, "file v3")], landed.state);
    expect(done.state.sessions.a).toBeUndefined();
  });

  it("forgets an idle task when it closes", () => {
    const { state } = run([open, { type: "close" }]);

    expect(state).toEqual(EMPTY_EDITOR);
  });

  it("keeps a failed task after it closes, and reopens it with its draft", () => {
    const { state } = run([
      open,
      change({ due: "2026-10-27" }),
      failed("disk full"),
      { type: "close" },
      { type: "open", id: "a", draft: draft(), base: "fresh" },
    ]);

    expect(state.openId).toBe("a");
    expect(state.sessions.a?.draft.due).toBe("2026-10-27");
    expect(state.sessions.a?.base).toBe(OPENED);
  });

  it("drops a task and closes it when it shows", () => {
    const { state } = run([open, { type: "drop", id: "a" }]);

    expect(state).toEqual(EMPTY_EDITOR);
  });

  it("ignores a write that lands after its task was dropped", () => {
    const { state, jobs } = run([
      open,
      change({ due: "2026-10-27" }),
      change({ due: "2026-10-28" }),
      { type: "drop", id: "a" },
      written(draft({ due: "2026-10-27" }), "file v2"),
    ]);

    expect(jobs).toHaveLength(1);
    expect(state).toEqual(EMPTY_EDITOR);
  });
});
