import { describe, expect, it } from "vitest";
import { applyPatch } from "./patch";
import type { TaskItem } from "./query";

function task(text: string): TaskItem {
  return {
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
