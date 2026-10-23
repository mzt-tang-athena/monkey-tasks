import { describe, expect, it } from "vitest";
import { validateNote, taskFrontmatter } from "@monkey-tasks/schemas";
import { applyPatch } from "./patch";
import type { TaskItem } from "./query";

function task(text: string): TaskItem {
  return {
    id: "content://vault/Tasks/Call.md",
    uri: "content://vault/Tasks/Call.md",
    fileName: "Call.md",
    name: "Call",
    text,
    body: "",
    data: { kind: "[[tasks]]", created: "2026-10-20" },
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
lists:
  - [[Main]]
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
