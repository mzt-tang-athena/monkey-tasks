import { describe, expect, it } from "vitest";
import { validateNote, taskFrontmatter } from "@monkey-tasks/schemas";
import { applyPatch } from "./patch";
import type { TaskItem } from "@/types/task";

function task(text: string): TaskItem {
  return {
    id: "content://vault/Tasks/Call.md",
    uri: "content://vault/Tasks/Call.md",
    fileName: "Call.md",
    name: "Call",
    text,
    body: "",
    data: {
      kind: "[[tasks]]",
      created: "2026-10-20",
      "alert weight": "harsh",
    },
  };
}

const note = `---
kind: "[[tasks]]"
created: 2026-10-20
---

Body stays.
`;

describe("applyPatch", () => {
  it("moves the text and the data together", () => {
    const before = task(note);
    const after = applyPatch(before, { completed: "2026-10-22" });
    expect(after.data?.completed).toBe("2026-10-22");
    expect(after.text).toContain("completed: 2026-10-22");
    // The body is untouched.
    expect(after.text).toContain("Body stays.");
    // The original is not mutated.
    expect(before.data?.completed).toBeUndefined();
    expect(before.text).toBe(note);
  });

  it("removes a key from both the data and the text on null", () => {
    const done = applyPatch(task(note), { completed: "2026-10-22" });
    const undone = applyPatch(done, { completed: null });
    expect(undone.data?.completed).toBeUndefined();
    expect(undone.text).not.toContain("completed");
  });

  it("chains: the second patch builds on the first", () => {
    const once = applyPatch(task(note), { due: "2026-10-23" });
    const twice = applyPatch(once, { due: "2026-10-24" });
    expect(twice.data?.due).toBe("2026-10-24");
    expect(twice.text).toContain("due: 2026-10-24");
    expect(twice.text).not.toContain("2026-10-23");
  });

  it("leaves an unreadable note alone", () => {
    const broken: TaskItem = { ...task(note), data: null };
    expect(applyPatch(broken, { due: "2026-10-24" })).toBe(broken);
  });
});

describe("applyPatch, recurring drag", () => {
  it("keeps a note valid when a tick drops reminders and a drag adds one", () => {
    const recurring = `---
kind: "[[tasks]]"
created: 2026-10-23
due: 2026-10-23T07:00
recurrence: FREQ=WEEKLY
list: "[[Main]]"
reminders:
  - 2026-10-23T07:00
---
`;
    const start = task(recurring);
    // A date-only next due carries no alarm, so the tick removes the
    // property. The drag then writes a datetime reminder back.
    const ticked = applyPatch(start, {
      due: "2026-10-30",
      reminders: null,
    });
    const dragged = applyPatch(ticked, {
      due: "2026-11-01T07:00",
      reminders: ["2026-11-01T07:00"],
    });

    expect(dragged.text).toContain("reminders:\n  - 2026-11-01T07:00");
    expect(dragged.text).not.toContain("reminders:   -");
    const note = validateNote("Call.md", dragged.text, taskFrontmatter);
    expect(note.data).not.toBeNull();
    expect(note.data?.reminders).toEqual(["2026-11-01T07:00"]);
  });
});

describe("applyPatch on a deed", () => {
  const DEED_TEXT = `---
kind: "[[deeds]]"
status: "[[active]]"
parent deed: "[[Garden]]"
categories:
  - "[[digital]]"
after: "[[Order things]]"
---

Water the beds.
`;

  function deed(text = DEED_TEXT): TaskItem {
    return {
      ...task(text),
      id: "content://vault/Deeds/Water the beds.md",
      uri: "content://vault/Deeds/Water the beds.md",
      fileName: "Water the beds.md",
      name: "Water the beds",
      folder: "deeds",
      data: {
        kind: "[[tasks]]",
        status: "[[active]]",
        "alert weight": "harsh",
      },
    };
  }

  it("writes the task kind, adds created, and keeps every other property", () => {
    const after = applyPatch(deed(), { due: "2026-10-29" });

    expect(after.text).toContain('kind: "[[tasks]]"');
    expect(after.text).toMatch(/^created: /m);
    expect(after.text).toContain('status: "[[active]]"');
    expect(after.text).toContain('parent deed: "[[Garden]]"');
    expect(after.text).toContain('categories:\n  - "[[digital]]"');
    expect(after.text).toContain('after: "[[Order things]]"');
    expect(after.text).not.toContain("[[deeds]]");
    expect(after.data?.created).toBeDefined();
    const note = validateNote("Water the beds.md", after.text, taskFrontmatter);
    expect(note.data).not.toBeNull();
    expect(note.data?.due).toBe("2026-10-29");
  });

  it("leaves a note already in the task shape byte-identical", () => {
    const shaped = DEED_TEXT.replace(
      'kind: "[[deeds]]"',
      'kind: "[[tasks]]"\ncreated: 2026-09-12',
    );
    const start: TaskItem = {
      ...deed(shaped),
      data: {
        kind: "[[tasks]]",
        status: "[[active]]",
        "alert weight": "harsh",
        created: "2026-09-12",
      },
    };

    const after = applyPatch(start, { due: "2026-10-29" });

    expect(after.text).not.toContain("created: 2026-11");
    expect(after.text.match(/^created:/gm)).toHaveLength(1);
    expect(after.text).toContain("created: 2026-09-12");
  });
});
