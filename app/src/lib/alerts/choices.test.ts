import { describe, expect, it } from "vitest";
import { buttonAction, DONE_BUTTON } from "./actions";
import { RESCHEDULE_CHOICES, laterTarget, tomorrowTarget } from "./choices";

// The operator picked these times on 2026-11-25: Later is an hour on,
// rounded up to the next five minutes, and Tomorrow is nine in the
// morning. Every test pins a local moment, as a phone shows it.

describe("laterTarget", () => {
  it("moves an hour on and rounds up to the next five minutes", () => {
    expect(laterTarget(new Date(2026, 10, 25, 10, 0, 0))).toBe(
      "2026-11-25T11:00",
    );
    expect(laterTarget(new Date(2026, 10, 25, 10, 1, 0))).toBe(
      "2026-11-25T11:05",
    );
    expect(laterTarget(new Date(2026, 10, 25, 10, 4, 30))).toBe(
      "2026-11-25T11:05",
    );
    expect(laterTarget(new Date(2026, 10, 25, 10, 59, 0))).toBe(
      "2026-11-25T12:00",
    );
  });

  it("crosses midnight, the year's end, and a leap day", () => {
    expect(laterTarget(new Date(2026, 10, 25, 23, 30, 0))).toBe(
      "2026-11-26T00:30",
    );
    expect(laterTarget(new Date(2026, 11, 31, 23, 30, 0))).toBe(
      "2027-01-01T00:30",
    );
    expect(laterTarget(new Date(2028, 1, 29, 23, 58, 0))).toBe(
      "2028-03-01T01:00",
    );
  });
});

describe("tomorrowTarget", () => {
  it("is nine tomorrow morning, whatever the hour now", () => {
    expect(tomorrowTarget(new Date(2026, 10, 25, 6, 0, 0))).toBe(
      "2026-11-26T09:00",
    );
    expect(tomorrowTarget(new Date(2026, 10, 25, 22, 15, 0))).toBe(
      "2026-11-26T09:00",
    );
  });

  it("crosses a month and a year", () => {
    expect(tomorrowTarget(new Date(2026, 11, 31, 12, 0, 0))).toBe(
      "2027-01-01T09:00",
    );
    expect(tomorrowTarget(new Date(2026, 0, 31, 12, 0, 0))).toBe(
      "2026-02-01T09:00",
    );
  });
});

describe("the button set", () => {
  const now = new Date(2026, 10, 25, 10, 1, 0);

  it("is Done, Later and Tomorrow", () => {
    expect(RESCHEDULE_CHOICES.map((choice) => choice.title)).toEqual([
      "Later",
      "Tomorrow",
    ]);
    // Android shows three buttons at most.
    expect(RESCHEDULE_CHOICES.length + 1).toBeLessThanOrEqual(3);
  });

  it("reads each button back as its action", () => {
    expect(buttonAction(DONE_BUTTON, now)).toEqual({ kind: "done" });
    expect(buttonAction("later", now)).toEqual({
      kind: "reschedule",
      target: "2026-11-25T11:05",
    });
    expect(buttonAction("tomorrow", now)).toEqual({
      kind: "reschedule",
      target: "2026-11-26T09:00",
    });
  });

  it("reads a button this build lacks as nothing", () => {
    expect(buttonAction("snooze", now)).toBeNull();
  });
});
