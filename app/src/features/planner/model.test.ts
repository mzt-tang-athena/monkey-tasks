import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import type { WeekStart } from "@/lib/settings";
import { isoOf } from "@/utils/dates";
import {
  hasTime,
  inSourceList,
  parseMode,
  parsePlannerDay,
  plannerDayParam,
  sortByTimeOfDay,
  sortOpenFirst,
  sourceLabel,
  startOfWeek,
  tasksForDay,
  tasksForDayAll,
  timeOf,
  withKeptTime,
  withTime,
} from "./model";

function task(name: string, data: TaskFrontmatter | null): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data,
  };
}

function due(value: string): TaskFrontmatter {
  return {
    kind: "[[tasks]]",
    created: "2026-10-20",
    "alert weight": "harsh",
    due: value,
  };
}

function doneDue(value: string): TaskFrontmatter {
  return {
    kind: "[[tasks]]",
    created: "2026-10-20",
    "alert weight": "harsh",
    due: value,
    completed: "2026-10-21",
  };
}

function recurringDue(value: string, recurrence: string): TaskFrontmatter {
  return {
    kind: "[[tasks]]",
    created: "2026-10-20",
    "alert weight": "harsh",
    due: value,
    recurrence,
  };
}

const DAY = new Date(2026, 9, 22);

describe("withTime", () => {
  it("sets the hour on the shown day and keeps the given minute", () => {
    expect(withTime(DAY, 14, 30)).toBe("2026-10-22T14:30");
  });

  it("defaults the minute to zero", () => {
    expect(withTime(DAY, 9)).toBe("2026-10-22T09:00");
  });
});

describe("withKeptTime", () => {
  it("keeps the time of day from a due value that had one", () => {
    const previous = { date: new Date(2026, 9, 20, 16, 45), hasTime: true };
    expect(withKeptTime(new Date(2026, 9, 24), previous)).toBe(
      "2026-10-24T16:45",
    );
  });

  it("drops the time when the source was date only", () => {
    const previous = { date: new Date(2026, 9, 20), hasTime: false };
    expect(withKeptTime(new Date(2026, 9, 24), previous)).toBe("2026-10-24");
  });

  it("writes a date only value when there was no previous due", () => {
    expect(withKeptTime(new Date(2026, 9, 24), null)).toBe("2026-10-24");
  });
});

describe("hasTime and timeOf", () => {
  it("treats a date only value as all day", () => {
    const item = task("Alpha", due("2026-10-22"));
    expect(hasTime(item)).toBe(false);
    // timeOf reads the parsed clock whatever the flag says, so hasTime
    // is the gate that keeps an all-day task out of the timeline.
    expect(timeOf(item)).toBe("12:00 AM");
  });

  it("reads the clock from a datetime value", () => {
    const item = task("Alpha", due("2026-10-22T09:05"));
    expect(hasTime(item)).toBe(true);
    expect(timeOf(item)).toBe("9:05 AM");
  });

  it("formats noon and midnight on the twelve hour clock", () => {
    expect(timeOf(task("Alpha", due("2026-10-22T12:00")))).toBe("12:00 PM");
    expect(timeOf(task("Alpha", due("2026-10-22T00:00")))).toBe("12:00 AM");
  });

  it("has neither for an undated task", () => {
    const item = task("Alpha", {
      kind: "[[tasks]]",
      created: "2026-10-20",
      "alert weight": "harsh",
    });
    expect(hasTime(item)).toBe(false);
    expect(timeOf(item)).toBe("");
  });
});

describe("sortOpenFirst", () => {
  it("puts open tasks before done ones and keeps order inside each group", () => {
    const items = [
      task("Alpha", due("2026-10-22")),
      task("Bravo", doneDue("2026-10-22")),
      task("Charlie", due("2026-10-22")),
    ];
    expect(sortOpenFirst(items).map((item) => item.name)).toEqual([
      "Alpha",
      "Charlie",
      "Bravo",
    ]);
  });

  it("keeps the group boundary even when the done task is due earlier", () => {
    const items = [
      task("Bravo", doneDue("2026-10-01")),
      task("Alpha", due("2026-10-22")),
    ];
    expect(sortOpenFirst(items).map((item) => item.name)).toEqual([
      "Alpha",
      "Bravo",
    ]);
  });
});

describe("sortByTimeOfDay", () => {
  it("orders a recurring occurrence by its time, not by its stored day", () => {
    // The daily task is stored a day earlier at 7 PM. On the 27th its
    // occurrence must still come after the 2:30 PM task.
    const items = [
      task("Supplements", recurringDue("2026-10-26T19:00", "RRULE:FREQ=DAILY")),
      task("Dentist", due("2026-10-27T14:30")),
    ];
    expect(sortByTimeOfDay(items).map((item) => item.name)).toEqual([
      "Dentist",
      "Supplements",
    ]);
  });

  it("puts all day tasks first, by name, then timed ones by time", () => {
    const items = [
      task("Late", due("2026-10-27T21:00")),
      task("Plan", due("2026-10-27")),
      task("Early", due("2026-10-27T07:15")),
      task("Groceries", due("2026-10-27")),
    ];
    expect(sortByTimeOfDay(items).map((item) => item.name)).toEqual([
      "Groceries",
      "Plan",
      "Early",
      "Late",
    ]);
  });
});

describe("inSourceList", () => {
  const focused = task("Alpha", {
    kind: "[[tasks]]",
    created: "2026-10-20",
    "alert weight": "harsh",
    list: "[[Focus]]",
  });

  it("matches a list wikilink only for its own name", () => {
    expect(inSourceList(focused, "Focus")).toBe(true);
    expect(inSourceList(focused, "Foc")).toBe(false);
    expect(inSourceList(focused, "Focuses")).toBe(false);
    expect(inSourceList(focused, "Main")).toBe(false);
  });

  it("treats an unlisted task as Main", () => {
    const loose = task("Bravo", {
      kind: "[[tasks]]",
      created: "2026-10-20",
      "alert weight": "harsh",
    });
    expect(inSourceList(loose, "Main")).toBe(true);
    expect(inSourceList(loose, "Focus")).toBe(false);
  });
});

describe("parseMode", () => {
  it("accepts the three modes", () => {
    expect(parseMode("day")).toBe("day");
    expect(parseMode("week")).toBe("week");
    expect(parseMode("month")).toBe("month");
  });

  it("defaults to day when absent or unknown", () => {
    expect(parseMode(undefined)).toBe("day");
    expect(parseMode("year")).toBe("day");
    expect(parseMode("")).toBe("day");
  });

  it("reads the first value of a repeated param", () => {
    expect(parseMode(["week", "month"])).toBe("week");
    expect(parseMode(["year"])).toBe("day");
    expect(parseMode([])).toBe("day");
  });
});

describe("parsePlannerDay", () => {
  it("reads a date at local midnight", () => {
    const day = parsePlannerDay("2026-10-24", DAY);
    expect(day.getTime()).toBe(new Date(2026, 9, 24).getTime());
    expect(day.getHours()).toBe(0);
  });

  it("falls back to the start of today for an impossible date", () => {
    const now = new Date(2026, 9, 22, 15, 45);
    expect(parsePlannerDay("2026-02-30", now).getTime()).toBe(
      new Date(2026, 9, 22).getTime(),
    );
  });

  it("falls back to the start of today when absent or malformed", () => {
    const now = new Date(2026, 9, 22, 15, 45);
    expect(parsePlannerDay(undefined, now).getTime()).toBe(
      new Date(2026, 9, 22).getTime(),
    );
    expect(parsePlannerDay("tomorrow", now).getTime()).toBe(
      new Date(2026, 9, 22).getTime(),
    );
    // A datetime is not a day param: only the plain date is accepted.
    expect(parsePlannerDay("2026-10-22T09:00", now).getTime()).toBe(
      new Date(2026, 9, 22).getTime(),
    );
  });

  it("reads the first value of a repeated param", () => {
    expect(parsePlannerDay(["2026-10-24"], DAY).getTime()).toBe(
      new Date(2026, 9, 24).getTime(),
    );
    expect(parsePlannerDay(["2026-02-30"], DAY).getTime()).toBe(DAY.getTime());
    expect(parsePlannerDay([], DAY).getTime()).toBe(DAY.getTime());
  });
});

describe("plannerDayParam", () => {
  it("writes the calendar date", () => {
    expect(plannerDayParam(DAY)).toBe("2026-10-22");
  });

  it("pads single digit months and days", () => {
    expect(plannerDayParam(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("drops the time of day", () => {
    expect(plannerDayParam(new Date(2026, 9, 24, 18, 30))).toBe("2026-10-24");
  });
});

describe("tasksForDay", () => {
  it("shows a recurring task on each occurrence, not only its due day", () => {
    const daily = task("standup", recurringDue("2026-10-21", "FREQ=DAILY"));
    expect(tasksForDay([daily], DAY).map((item) => item.name)).toEqual([
      "standup",
    ]);
    expect(tasksForDay([daily], new Date(2026, 9, 24))).toHaveLength(1);
    // The day before its start is not an occurrence.
    expect(tasksForDay([daily], new Date(2026, 9, 20))).toEqual([]);
  });

  it("drops a done task from the open list but keeps it in tasksForDayAll", () => {
    const shipped = task("shipped", doneDue("2026-10-22"));
    expect(tasksForDay([shipped], DAY)).toEqual([]);
    expect(tasksForDayAll([shipped], DAY).map((item) => item.name)).toEqual([
      "shipped",
    ]);
  });

  it("never shows a done recurring task on a later occurrence", () => {
    const done = task("standup", {
      ...recurringDue("2026-10-21", "FREQ=DAILY"),
      completed: "2026-10-21",
    });
    expect(tasksForDayAll([done], DAY)).toEqual([]);
  });
});

describe("startOfWeek", () => {
  it("starts the week on Monday, across a month and a year edge", () => {
    // 1 November 2026 is a Sunday, and 1 January 2027 a Friday.
    expect(isoOf(startOfWeek(new Date(2026, 10, 1), "monday"))).toBe("2026-10-26");
    expect(isoOf(startOfWeek(new Date(2027, 0, 1), "monday"))).toBe("2026-12-28");
  });

  it("starts the week on Sunday, across a month and a year edge", () => {
    expect(isoOf(startOfWeek(new Date(2026, 10, 1), "sunday"))).toBe("2026-11-01");
    expect(isoOf(startOfWeek(new Date(2027, 0, 1), "sunday"))).toBe("2026-12-27");
  });

  it("leaves a day in its own week at either setting", () => {
    // Thursday 31 December 2026: Monday 28, Sunday 27.
    expect(isoOf(startOfWeek(new Date(2026, 11, 31), "monday"))).toBe("2026-12-28");
    expect(isoOf(startOfWeek(new Date(2026, 11, 31), "sunday"))).toBe("2026-12-27");
  });
});

describe("sourceLabel", () => {
  // Monday 26 October 2026.
  const today = new Date(2026, 9, 26);
  const label = (
    mode: "day" | "week" | "month",
    day: Date,
    weekStart: WeekStart = "monday",
  ) => sourceLabel("due-period", mode, day, today, weekStart);

  it("names a day relative to today", () => {
    expect(label("day", today)).toBe("Due today");
    expect(label("day", new Date(2026, 9, 27))).toBe("Due tomorrow");
    expect(label("day", new Date(2026, 9, 25))).toBe("Due yesterday");
    expect(label("day", new Date(2026, 9, 28))).toBe("Due Wed, 28 Oct");
  });

  it("adds the year to a day in another year", () => {
    expect(label("day", new Date(2027, 0, 4))).toBe("Due Mon, 4 Jan 2027");
  });

  it("names a week by the range it runs, Monday to Sunday", () => {
    expect(label("week", new Date(2026, 9, 28))).toBe("Due this week");
    // 8 November 2026 is a Sunday: its Monday week runs 2 to 8 November.
    expect(label("week", new Date(2026, 10, 8))).toBe("Due 2 to 8 Nov");
    expect(label("week", new Date(2026, 10, 11))).toBe("Due 9 to 15 Nov");
  });

  it("runs Sunday to Saturday when the week starts on Sunday", () => {
    // 9 November 2026 is a Monday, so the two settings put it in
    // different weeks.
    expect(label("week", new Date(2026, 10, 9), "sunday")).toBe("Due 8 to 14 Nov");
    expect(label("week", new Date(2026, 10, 9))).toBe("Due 9 to 15 Nov");
  });

  it("names both months when a week crosses a month end", () => {
    // 30 November 2026 is a Monday, so its week runs into December.
    expect(label("week", new Date(2026, 10, 30))).toBe("Due 30 Nov to 6 Dec");
    // 29 November 2026 is a Sunday, and Sunday starts its own week.
    expect(label("week", new Date(2026, 10, 29))).toBe("Due 23 to 29 Nov");
    expect(label("week", new Date(2026, 10, 29), "sunday")).toBe("Due 29 Nov to 5 Dec");
  });

  it("names both years when a week crosses a year end", () => {
    // 1 January 2027 is a Friday.
    expect(label("week", new Date(2027, 0, 1))).toBe("Due 28 Dec to 3 Jan 2027");
    expect(label("week", new Date(2027, 0, 1), "sunday")).toBe("Due 27 Dec to 2 Jan 2027");
  });

  it("names a month, with its year when the year differs", () => {
    expect(label("month", new Date(2026, 9, 3))).toBe("Due this month");
    expect(label("month", new Date(2026, 10, 1))).toBe("Due November");
    expect(label("month", new Date(2027, 1, 1))).toBe("Due February 2027");
  });

  it("names a list by its own name in every mode", () => {
    expect(sourceLabel("Focus", "day", new Date(2026, 9, 28), today, "monday")).toBe(
      "Focus",
    );
    expect(sourceLabel("Main", "month", new Date(2026, 10, 1), today, "sunday")).toBe(
      "Main",
    );
  });
});
