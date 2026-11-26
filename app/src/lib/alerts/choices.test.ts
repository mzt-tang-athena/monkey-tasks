import { describe, expect, it } from "vitest";
import {
  actionLabel,
  buttonAction,
  DONE_BUTTON,
  DROP_BUTTON,
  SNOOZE_BUTTON,
} from "./actions";
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

  it("holds Later and Tomorrow for the Snooze sheet", () => {
    expect(RESCHEDULE_CHOICES.map((choice) => choice.title)).toEqual([
      "Later",
      "Tomorrow",
    ]);
  });

  it("reads each button back as its action", () => {
    expect(buttonAction(DONE_BUTTON, now)).toEqual({ kind: "done" });
    expect(buttonAction(DROP_BUTTON, now)).toEqual({ kind: "drop" });
    expect(buttonAction("later", now)).toEqual({
      kind: "reschedule",
      target: "2026-11-25T11:05",
    });
    expect(buttonAction("tomorrow", now)).toEqual({
      kind: "reschedule",
      target: "2026-11-26T09:00",
    });
  });

  it("reads Snooze and a button this build lacks as nothing", () => {
    expect(buttonAction(SNOOZE_BUTTON, now)).toBeNull();
    expect(buttonAction("archive", now)).toBeNull();
  });

  it("names each action for the failure notice", () => {
    expect(actionLabel({ kind: "done" })).toBe("Done");
    expect(actionLabel({ kind: "drop" })).toBe("Didn't do");
    expect(actionLabel({ kind: "reschedule", target: "2026-11-25T11:05" })).toBe(
      "Snooze",
    );
  });
});
