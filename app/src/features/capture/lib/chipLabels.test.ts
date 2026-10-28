import { describe, expect, it } from "vitest";
import {
  dueChipLabel,
  recurrenceKeyword,
  targetLabel,
  timeChipLabel,
} from "./chipLabels";

describe("dueChipLabel", () => {
  it("names the weekday and the day of the month", () => {
    expect(dueChipLabel("2026-10-21")).toBe("Wed 21");
  });

  it("shows nothing for a value it cannot read", () => {
    expect(dueChipLabel("next tuesday")).toBe("");
  });
});

describe("timeChipLabel", () => {
  it("reads the clock out of a datetime", () => {
    expect(timeChipLabel("2026-10-21T13:05")).toBe("1:05 PM");
  });

  it("falls back to midnight for a date with no time", () => {
    expect(timeChipLabel("2026-10-21")).toBe("12:00 AM");
  });

  it("shows nothing for a value it cannot read", () => {
    expect(timeChipLabel("next tuesday")).toBe("");
  });
});

describe("recurrenceKeyword", () => {
  it("lowers the frequency word", () => {
    expect(recurrenceKeyword("FREQ=WEEKLY")).toBe("weekly");
  });

  it("shows nothing for a rule without a frequency", () => {
    expect(recurrenceKeyword("INTERVAL=2")).toBe("");
  });
});

describe("targetLabel", () => {
  it("names the Main target", () => {
    expect(targetLabel({ kind: "main" })).toBe("Main");
  });

  it("names a list by its own name", () => {
    expect(targetLabel({ kind: "list", name: "Focus" })).toBe("Focus");
  });
});
