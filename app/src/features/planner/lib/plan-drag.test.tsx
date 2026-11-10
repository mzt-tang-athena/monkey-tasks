import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import { patchForDrop } from "./plan-drag";

/** A task note with the frontmatter fields a drop may touch. */
function task(due?: string): TaskItem {
  const uri = "content://vault/Tasks/Review budget.md";
  return {
    id: uri,
    uri,
    fileName: "Review budget.md",
    name: "Review budget",
    text: "",
    body: "",
    data: {
      kind: "[[tasks]]",
      created: "2026-10-01",
      ...(due == null ? {} : { due }),
    },
  };
}

const routeDay = new Date(2026, 9, 26);

describe("patchForDrop", () => {
  it("writes the hour on the route day and keeps the task's minute", () => {
    const patch = patchForDrop(task("2026-10-26T10:25"), { kind: "hour", hour: 14 }, routeDay);

    expect(patch).toEqual({ due: "2026-10-26T14:25" });
  });

  it("writes the route day, not the day the task was stored on", () => {
    const patch = patchForDrop(
      task("2026-10-27T10:25"),
      { kind: "hour", hour: 8 },
      new Date(2026, 9, 29),
    );

    expect(patch).toEqual({ due: "2026-10-29T08:25" });
  });

  it("writes a bare hour for a task with no time, keeping minute zero", () => {
    const patch = patchForDrop(task("2026-10-26"), { kind: "hour", hour: 7 }, routeDay);

    expect(patch).toEqual({ due: "2026-10-26T07:00" });
  });

  it("writes the day and keeps the task's time", () => {
    const patch = patchForDrop(task("2026-10-26T19:00"), { kind: "day", iso: "2026-10-29" }, routeDay);

    expect(patch).toEqual({ due: "2026-10-29T19:00" });
  });

  it("writes a bare day for a task with no time", () => {
    const patch = patchForDrop(task("2026-10-26"), { kind: "day", iso: "2026-10-29" }, routeDay);

    expect(patch).toEqual({ due: "2026-10-29" });
  });

  it("writes the day for a task with no due date", () => {
    const patch = patchForDrop(task(), { kind: "day", iso: "2026-10-29" }, routeDay);

    expect(patch).toEqual({ due: "2026-10-29" });
  });

  it("writes nothing for a day that is not a date", () => {
    const patch = patchForDrop(task("2026-10-26T19:00"), { kind: "day", iso: "2026-02-30" }, routeDay);

    expect(patch).toEqual({});
  });
});
