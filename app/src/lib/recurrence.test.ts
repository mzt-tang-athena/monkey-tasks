import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { formatLocal } from "@/utils/dates";
import type { TaskItem } from "@/types/task";
import {
  nextAfter,
  occurrencesBetween,
  occursOn,
} from "./recurrence";

function task(data: TaskFrontmatter): TaskItem {
  const uri = "content://vault/Tasks/recurring.md";
  return {
    id: uri,
    uri,
    fileName: "recurring.md",
    name: "recurring",
    text: "",
    body: "",
    data,
  };
}

function recurring(
  due: string,
  recurrence: string,
  completed?: string,
): TaskItem {
  return task({
    kind: "[[tasks]]",
    created: "2026-10-01",
    due,
    recurrence,
    ...(completed == null ? {} : { completed }),
  });
}

function isos(days: Date[]): string[] {
  return days.map((day) => formatLocal(day, false));
}

// Local-time dates throughout: the app stores and renders wall-clock
// values, so the expectations must not depend on the machine timezone.
describe("occursOn", () => {
  it("puts a daily rule on its start day and the three days after", () => {
    const daily = recurring("2026-10-21", "FREQ=DAILY");
    expect(occursOn(daily, new Date(2026, 9, 21))).toBe(true);
    expect(occursOn(daily, new Date(2026, 9, 22))).toBe(true);
    expect(occursOn(daily, new Date(2026, 9, 23))).toBe(true);
    expect(occursOn(daily, new Date(2026, 9, 24))).toBe(true);
    // Nothing before the rule's DTSTART.
    expect(occursOn(daily, new Date(2026, 9, 20))).toBe(false);
    expect(occursOn(daily, new Date(2026, 8, 30))).toBe(false);
  });

  it("keeps the time of day when a timed rule occurs", () => {
    const timed = recurring("2026-10-21T07:30", "FREQ=DAILY");
    expect(occursOn(timed, new Date(2026, 9, 22, 18, 0))).toBe(true);
    expect(occursOn(timed, new Date(2026, 9, 20, 7, 30))).toBe(false);
  });

  it("puts a weekly BYDAY rule on its weekday across a month", () => {
    // 2026-10-05 is a Monday.
    const weekly = recurring("2026-10-05", "FREQ=WEEKLY;BYDAY=MO");
    const days = occurrencesBetween(
      weekly,
      new Date(2026, 9, 1),
      new Date(2026, 9, 31),
    );
    expect(isos(days)).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
    expect(days.every((day) => day.getDay() === 1)).toBe(true);
    // The Tuesday after the first Monday is not an occurrence.
    expect(occursOn(weekly, new Date(2026, 9, 6))).toBe(false);
  });

  it("never shows a future occurrence of a done recurring task", () => {
    const done = recurring("2026-10-21", "FREQ=DAILY", "2026-10-21");
    expect(occursOn(done, new Date(2026, 9, 22))).toBe(false);
    expect(occursOn(done, new Date(2026, 9, 30))).toBe(false);
    // Its stored due day is the one day it still touches.
    expect(
      isos(
        occurrencesBetween(
          done,
          new Date(2026, 9, 20),
          new Date(2026, 9, 25),
        ),
      ),
    ).toEqual(["2026-10-21"]);
  });

  it("keeps a non-recurring task on its due day only", () => {
    const once = task({
      kind: "[[tasks]]",
      created: "2026-10-01",
      due: "2026-10-22",
    });
    expect(occursOn(once, new Date(2026, 9, 22))).toBe(true);
    expect(occursOn(once, new Date(2026, 9, 21))).toBe(false);
    expect(occursOn(once, new Date(2026, 9, 23))).toBe(false);
  });

  it("never touches a day without a due date", () => {
    const undated = task({ kind: "[[tasks]]", created: "2026-10-01" });
    expect(occursOn(undated, new Date(2026, 9, 22))).toBe(false);
    expect(
      occurrencesBetween(
        undated,
        new Date(2026, 9, 1),
        new Date(2026, 9, 31),
      ),
    ).toEqual([]);
  });

  it("ignores an unusable rule but keeps the stored due day", () => {
    const broken = recurring("2026-10-21", "not a rule");
    expect(occursOn(broken, new Date(2026, 9, 21))).toBe(true);
    expect(occursOn(broken, new Date(2026, 9, 22))).toBe(false);
  });
});

describe("occurrencesBetween", () => {
  it("lists each day of a daily rule once across the range", () => {
    const daily = recurring("2026-10-21", "FREQ=DAILY");
    expect(
      isos(
        occurrencesBetween(
          daily,
          new Date(2026, 9, 20),
          new Date(2026, 9, 24),
        ),
      ),
    ).toEqual([
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
  });

  it("returns nothing for a reversed range", () => {
    const daily = recurring("2026-10-21", "FREQ=DAILY");
    expect(
      occurrencesBetween(daily, new Date(2026, 9, 24), new Date(2026, 9, 20)),
    ).toEqual([]);
  });
});

describe("nextAfter", () => {
  it("returns the occurrence after the stored due, not after today", () => {
    // A task finished late still follows its schedule.
    expect(nextAfter("FREQ=WEEKLY", "2026-10-01")).toBe("2026-10-08");
    expect(nextAfter("FREQ=WEEKLY", "2026-10-20")).toBe("2026-10-27");
  });

  it("keeps the time of day on a timed occurrence", () => {
    expect(nextAfter("FREQ=DAILY", "2026-10-20T09:00")).toBe(
      "2026-10-21T09:00",
    );
  });

  it("returns null with no due or an unusable rule", () => {
    expect(nextAfter("FREQ=WEEKLY", null)).toBeNull();
    expect(nextAfter("", "2026-10-20")).toBeNull();
    expect(nextAfter("every week", "2026-10-20")).toBeNull();
  });

  it("returns null once a counted rule is exhausted", () => {
    expect(nextAfter("FREQ=DAILY;COUNT=1", "2026-10-20")).toBeNull();
    expect(nextAfter("FREQ=DAILY;COUNT=2", "2026-10-20")).toBe("2026-10-21");
  });
});
