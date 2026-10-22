import { describe, expect, it } from "vitest";
import {
  addDays,
  formatLocal,
  parseStoredDate,
  todayIso,
} from "./dates";

describe("formatLocal / parseStoredDate round trip", () => {
  it("round trips a date-only due over the real write path", () => {
    const day = new Date(2026, 9, 21);
    const stored = formatLocal(day, false);
    expect(stored).toBe("2026-10-21");
    const parsed = parseStoredDate(stored);
    expect(parsed?.hasTime).toBe(false);
    expect(Math.abs(startOfDay(parsed!.date) - startOfDay(day)) < 1000).toBe(
      true,
    );
  });

  it("round trips a timed due over the real write path", () => {
    const day = new Date(2026, 9, 21, 14, 30);
    const stored = formatLocal(day, true);
    expect(stored).toBe("2026-10-21T14:30");
    const parsed = parseStoredDate(stored);
    expect(parsed?.hasTime).toBe(true);
    expect(parsed!.date.getHours()).toBe(14);
    expect(parsed!.date.getMinutes()).toBe(30);
  });
});

describe("parseStoredDate", () => {
  it("accepts schema-legal seconds and ignores them", () => {
    const parsed = parseStoredDate("2026-10-21T15:00:30");
    expect(parsed?.hasTime).toBe(true);
    expect(parsed!.date.getHours()).toBe(15);
    expect(parsed!.date.getMinutes()).toBe(0);
  });

  it("rejects values that roll to a different calendar day", () => {
    // 2026-13-01 would become Jan 1 2027; 2026-02-30 would become
    // Mar 2. The app shows such notes as undated, loudly, instead
    // of filing them under the wrong month.
    expect(parseStoredDate("2026-13-01")).toBeNull();
    expect(parseStoredDate("2026-02-30")).toBeNull();
    expect(parseStoredDate("2026-10-21T24:30")).toBeNull();
  });

  it("still parses the shapes the app itself writes", () => {
    for (const value of ["2026-10-21", "2026-10-21T07:05", "2026-02-29"]) {
      // 2026 is not a leap year; 2024 is.
      expect(parseStoredDate("2024-02-29")).not.toBeNull();
      expect(parseStoredDate("2026-02-29")).toBeNull();
      if (value !== "2026-02-29") {
        expect(parseStoredDate(value)).not.toBeNull();
      }
    }
  });

  it("rejects junk", () => {
    expect(parseStoredDate("tomorrow")).toBeNull();
    expect(parseStoredDate("2026-10")).toBeNull();
  });
});

describe("addDays / dayLabel across a DST gap", () => {
  it("keeps a 1-day step across the fall-back night", () => {
    const before = new Date(2026, 10, 1); // Sunday
    const after = addDays(before, 1);
    expect(after.getDate()).toBe(2);
    expect(after.getDay()).toBe(1);
  });
});

describe("todayIso", () => {
  it("writes the local date", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}
