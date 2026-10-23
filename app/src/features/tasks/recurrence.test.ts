import { describe, expect, it } from "vitest";
import { nextDue } from "./recurrence";

// Local-time dates throughout: the app stores and renders wall-clock
// values, so the expectations must not depend on the machine timezone.
describe("nextDue", () => {
  it("advances a daily rule by one day and keeps the time", () => {
    expect(
      nextDue("FREQ=DAILY", "2026-10-21T07:30", new Date(2026, 9, 21, 9, 0)),
    ).toBe("2026-10-22T07:30");
  });

  it("moves a weekly BYDAY rule to its next weekday from a mid-week due", () => {
    // 2026-10-21 is a Wednesday; the next Monday is the 26th.
    expect(
      nextDue("FREQ=WEEKLY;BYDAY=MO", "2026-10-21", new Date(2026, 9, 21, 9, 0)),
    ).toBe("2026-10-26");
  });

  it("honours INTERVAL for every other day", () => {
    expect(
      nextDue(
        "FREQ=DAILY;INTERVAL=2",
        "2026-10-20",
        new Date(2026, 9, 21, 9, 0),
      ),
    ).toBe("2026-10-22");
  });

  it("returns null for a rule it cannot parse", () => {
    expect(
      nextDue("not a rule", "2026-10-21", new Date(2026, 9, 21)),
    ).toBeNull();
    expect(
      nextDue("FREQ=BOGUS", "2026-10-21", new Date(2026, 9, 21)),
    ).toBeNull();
    expect(nextDue("", "2026-10-21", new Date(2026, 9, 21))).toBeNull();
  });

  it("returns null when the rule has no occurrence left", () => {
    expect(
      nextDue(
        "FREQ=DAILY;UNTIL=20260101T000000Z",
        "2026-10-21",
        new Date(2026, 9, 21, 9, 0),
      ),
    ).toBeNull();
  });

  it("rolls a long-past due date into the future", () => {
    expect(
      nextDue("FREQ=DAILY", "2026-01-01", new Date(2026, 9, 22, 10, 0)),
    ).toBe("2026-10-23");
  });

  it("anchors on now when the task has no due date", () => {
    expect(nextDue("FREQ=DAILY", null, new Date(2026, 9, 21, 23, 45))).toBe(
      "2026-10-22",
    );
  });

  it("anchors on now when the stored due date is unusable", () => {
    expect(nextDue("FREQ=DAILY", "someday", new Date(2026, 9, 21, 9, 0))).toBe(
      "2026-10-22",
    );
    expect(nextDue("FREQ=WEEKLY", "2026-13-01", new Date(2026, 9, 21))).toBe(
      "2026-10-28",
    );
  });
});
