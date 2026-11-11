import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { formatLocal } from "@/utils/dates";
import type { TaskItem } from "@/types/task";
import {
  monthEndRule,
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

/** The due dates after `due`, from a rule that keeps its text. */
function ticks(rule: string, due: string, count: number): string[] {
  const dates: string[] = [];
  let current: string | null = due;
  for (let n = 0; n < count && current != null; n += 1) {
    current = nextAfter(rule, current);
    if (current != null) {
      dates.push(current);
    }
  }
  return dates;
}

describe("monthEndRule (ticket 0066)", () => {
  it("keeps a bare monthly rule for day 1 to 28", () => {
    expect(monthEndRule("FREQ=MONTHLY", "2027-01-15")).toBe("FREQ=MONTHLY");
    expect(monthEndRule("FREQ=MONTHLY", "2027-01-28")).toBe("FREQ=MONTHLY");
    expect(monthEndRule("FREQ=MONTHLY;INTERVAL=2", "2027-01-28T09:00")).toBe(
      "FREQ=MONTHLY;INTERVAL=2",
    );
  });

  it("writes the month-end rule for a due day after the 28th", () => {
    expect(monthEndRule("FREQ=MONTHLY", "2027-01-29")).toBe(
      "FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1",
    );
    expect(monthEndRule("FREQ=MONTHLY", "2027-01-30")).toBe(
      "FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1",
    );
    expect(monthEndRule("FREQ=MONTHLY", "2027-01-31T08:30")).toBe(
      "FREQ=MONTHLY;BYMONTHDAY=-1",
    );
  });

  it("keeps the interval", () => {
    expect(monthEndRule("FREQ=MONTHLY;INTERVAL=2", "2026-12-30")).toBe(
      "FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=28,29,30;BYSETPOS=-1",
    );
    expect(monthEndRule("FREQ=MONTHLY;INTERVAL=2", "2026-12-31")).toBe(
      "FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1",
    );
  });

  it("writes the rule for a yearly task due on 29 February", () => {
    expect(monthEndRule("FREQ=YEARLY", "2028-02-29")).toBe(
      "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1",
    );
    expect(monthEndRule("FREQ=YEARLY", "2028-03-29")).toBe("FREQ=YEARLY");
    expect(monthEndRule("FREQ=YEARLY", "2028-01-31")).toBe("FREQ=YEARLY");
  });

  it("leaves any other rule alone", () => {
    for (const rule of [
      "FREQ=DAILY",
      "FREQ=WEEKLY;BYDAY=MO",
      "FREQ=MONTHLY;BYMONTHDAY=15",
      "FREQ=MONTHLY;COUNT=3",
      "every month",
    ]) {
      expect(monthEndRule(rule, "2027-01-31")).toBe(rule);
    }
  });

  it("leaves a rule it wrote alone while the due day follows the rule", () => {
    const rule = "FREQ=MONTHLY;BYMONTHDAY=-1";
    expect(monthEndRule(rule, "2027-02-28")).toBe(rule);
  });

  it("writes the rule again for a new due day when asked", () => {
    const rule = "FREQ=MONTHLY;BYMONTHDAY=-1";
    expect(monthEndRule(rule, "2027-02-15", true)).toBe("FREQ=MONTHLY");
    expect(monthEndRule(rule, "2027-02-28", true)).toBe("FREQ=MONTHLY");
    expect(monthEndRule("FREQ=MONTHLY", "2027-02-28", true)).toBe(
      "FREQ=MONTHLY",
    );
    expect(
      monthEndRule("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1", "2027-03-30", true),
    ).toBe("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=28,29,30;BYSETPOS=-1");
    expect(
      monthEndRule(
        "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1",
        "2029-03-05",
        true,
      ),
    ).toBe("FREQ=YEARLY");
  });
});

describe("month-end ticks (ticket 0066)", () => {
  function series(due: string, bare: string, count: number): string[] {
    return ticks(monthEndRule(bare, due), due, count);
  }

  it("lands a 31st task on the last day of each month", () => {
    expect(series("2027-01-31", "FREQ=MONTHLY", 3)).toEqual([
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
    ]);
  });

  it("lands a 30th task on 28 February, then on the 30th", () => {
    expect(series("2027-01-30", "FREQ=MONTHLY", 3)).toEqual([
      "2027-02-28",
      "2027-03-30",
      "2027-04-30",
    ]);
  });

  it("lands a 30th task on 29 February in a leap year", () => {
    expect(series("2028-01-30", "FREQ=MONTHLY", 2)).toEqual([
      "2028-02-29",
      "2028-03-30",
    ]);
  });

  it("lands a 29th task on 28 February, then on the 29th", () => {
    expect(series("2027-01-29", "FREQ=MONTHLY", 3)).toEqual([
      "2027-02-28",
      "2027-03-29",
      "2027-04-29",
    ]);
  });

  it("lands a 29th task on 29 February in a leap year", () => {
    expect(series("2028-01-29", "FREQ=MONTHLY", 2)).toEqual([
      "2028-02-29",
      "2028-03-29",
    ]);
  });

  it("keeps the time of day", () => {
    expect(series("2027-01-31T09:00", "FREQ=MONTHLY", 2)).toEqual([
      "2027-02-28T09:00",
      "2027-03-31T09:00",
    ]);
  });

  it("gives every other month on the 31st 28 February next", () => {
    expect(series("2026-12-31", "FREQ=MONTHLY;INTERVAL=2", 3)).toEqual([
      "2027-02-28",
      "2027-04-30",
      "2027-06-30",
    ]);
    expect(series("2026-12-30", "FREQ=MONTHLY;INTERVAL=2", 2)).toEqual([
      "2027-02-28",
      "2027-04-30",
    ]);
  });

  it("brings a 29 February task back on 28 February", () => {
    expect(series("2028-02-29", "FREQ=YEARLY", 2)).toEqual([
      "2029-02-28",
      "2030-02-28",
    ]);
  });

  it("keeps a 15th task monthly", () => {
    expect(series("2027-01-15", "FREQ=MONTHLY", 3)).toEqual([
      "2027-02-15",
      "2027-03-15",
      "2027-04-15",
    ]);
  });

  it("reads a bare monthly rule on the 31st as the last day", () => {
    expect(nextAfter("FREQ=MONTHLY", "2027-01-31")).toBe("2027-02-28");
    expect(nextAfter("FREQ=MONTHLY;INTERVAL=2", "2026-12-31")).toBe(
      "2027-02-28",
    );
  });

  it("paints a bare 31st task in February on the month grid", () => {
    const bare = recurring("2027-01-31", "FREQ=MONTHLY");
    expect(
      isos(
        occurrencesBetween(bare, new Date(2027, 1, 1), new Date(2027, 3, 30)),
      ),
    ).toEqual(["2027-02-28", "2027-03-31", "2027-04-30"]);
  });
});
