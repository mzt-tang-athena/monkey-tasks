import type { TaskEdit } from "@/types/task";

/** Where the one write of a task stands. */
export type WriteState =
  | { kind: "idle" }
  | { kind: "writing" }
  | { kind: "failed"; message: string };

/**
 * One open task in the editor. The draft is what the sheet shows. The
 * base is the file text the next write expects, so a write never lands
 * over a change it did not see (ADR 0017). One write runs at a time;
 * `queued` says a newer draft waits behind it.
 */
export type Session = {
  draft: TaskEdit;
  base: string;
  write: WriteState;
  queued: boolean;
};

/** A write to start: this draft, against this file text. */
export type WriteJob = { edit: TaskEdit; expected: string };

export type SessionEvent =
  | { type: "change"; patch: Partial<TaskEdit> }
  /** The write of `edit` landed, and the file now holds `text`. */
  | { type: "written"; edit: TaskEdit; text: string }
  | { type: "failed"; message: string }
  /** Write the draft again, against the latest text the store holds. */
  | { type: "retry"; base: string };

export function sameEdit(a: TaskEdit, b: TaskEdit): boolean {
  return (
    a.name === b.name &&
    a.due === b.due &&
    a.recurrence === b.recurrence &&
    a.list === b.list &&
    a.body === b.body &&
    a.reminders.length === b.reminders.length &&
    a.reminders.every((value, at) => value === b.reminders[at])
  );
}

function writing(session: Session): { session: Session; job: WriteJob } {
  return {
    session: { ...session, write: { kind: "writing" }, queued: false },
    job: { edit: session.draft, expected: session.base },
  };
}

/**
 * The write queue of one task, as a pure step. A change starts a write
 * unless one runs; then it waits, and only the latest draft goes next.
 * A failure keeps the draft on screen and starts nothing.
 */
export function step(
  session: Session,
  event: SessionEvent,
): { session: Session; job: WriteJob | null } {
  switch (event.type) {
    case "change": {
      const draft = { ...session.draft, ...event.patch };
      if (sameEdit(draft, session.draft)) {
        return { session, job: null };
      }
      const next = { ...session, draft };
      if (session.write.kind === "writing") {
        return { session: { ...next, queued: true }, job: null };
      }
      return writing(next);
    }
    case "written": {
      const next = { ...session, base: event.text };
      if (session.queued && !sameEdit(session.draft, event.edit)) {
        return writing(next);
      }
      return {
        session: { ...next, write: { kind: "idle" }, queued: false },
        job: null,
      };
    }
    case "failed":
      return {
        session: {
          ...session,
          write: { kind: "failed", message: event.message },
          queued: false,
        },
        job: null,
      };
    case "retry":
      if (session.write.kind !== "failed") {
        return { session, job: null };
      }
      return writing({ ...session, base: event.base });
  }
}

/**
 * Every task the editor holds. Only one shows. A closed task keeps its
 * session while its write runs or after it failed, so closing the sheet
 * never drops a write.
 */
export type EditorState = {
  openId: string | null;
  sessions: Readonly<Record<string, Session>>;
};

export type EditorEvent =
  | { type: "open"; id: string; draft: TaskEdit; base: string }
  | { type: "close" }
  /** Forget a task: it was deleted, ticked, or its failure dismissed. */
  | { type: "drop"; id: string }
  | { type: "session"; id: string; event: SessionEvent };

export const EMPTY_EDITOR: EditorState = { openId: null, sessions: {} };

/** A session the sheet no longer shows and that holds nothing unsaved. */
function settled(state: EditorState, id: string): boolean {
  const session = state.sessions[id];
  return (
    session != null &&
    id !== state.openId &&
    session.write.kind === "idle" &&
    !session.queued
  );
}

function without(state: EditorState, id: string): EditorState {
  const { [id]: _gone, ...rest } = state.sessions;
  return { ...state, sessions: rest };
}

export function reduce(
  state: EditorState,
  event: EditorEvent,
): { state: EditorState; job: { id: string; job: WriteJob } | null } {
  switch (event.type) {
    case "open": {
      // A task reopened while its write runs or after it failed shows
      // the draft it left with.
      const kept = state.sessions[event.id];
      const session: Session = kept ?? {
        draft: event.draft,
        base: event.base,
        write: { kind: "idle" },
        queued: false,
      };
      let next: EditorState = {
        openId: event.id,
        sessions: { ...state.sessions, [event.id]: session },
      };
      if (state.openId != null && settled(next, state.openId)) {
        next = without(next, state.openId);
      }
      return { state: next, job: null };
    }
    case "close": {
      if (state.openId == null) {
        return { state, job: null };
      }
      const closed = state.openId;
      const next = { ...state, openId: null };
      return {
        state: settled(next, closed) ? without(next, closed) : next,
        job: null,
      };
    }
    case "drop": {
      const next = without(state, event.id);
      return {
        state: state.openId === event.id ? { ...next, openId: null } : next,
        job: null,
      };
    }
    case "session": {
      const session = state.sessions[event.id];
      if (session == null) {
        return { state, job: null };
      }
      const result = step(session, event.event);
      const next: EditorState = {
        ...state,
        sessions: { ...state.sessions, [event.id]: result.session },
      };
      return {
        state: settled(next, event.id) ? without(next, event.id) : next,
        job: result.job == null ? null : { id: event.id, job: result.job },
      };
    }
  }
}
