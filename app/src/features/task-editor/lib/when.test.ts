import { describe, expect, it } from "vitest";
import { isoOf } from "@/utils/dates";
import {
  clockOf,
  dayHour,
  faceHour,
  monthRows,
  quickDays,
  storedOf,
  whenWords,
} from "./when";

// Monday 26 October 2026.
const today = new Date(2026, 9, 26, 9, 0);

describe("whenWords", () => {
  it("names near days and adds the time of a timed value", () => {
    expect(whenWords("2026-10-26", today)).toBe("Today");
    expect(whenWords("2026-10-27T09:00", today)).toBe("Tomorrow 9:00 AM");
    expect(whenWords("2026-11-02T18:30", today)).toBe("Mon, 2 Nov 6:30 PM");
  });

  it("adds the year when it is not this year", () => {
    expect(whenWords("2027-01-04", today)).toBe("Mon, 4 Jan 2027");
  });

  it("says when a stored value cannot be read", () => {
    expect(whenWords("next tuesday", today)).toBe("Unreadable date");
  });
});

describe("clockOf and storedOf", () => {
  it("reads the time of a datetime and none of a date", () => {
    expect(clockOf("2026-10-27T07:05")).toEqual({ hour: 7, minute: 5 });
    expect(clockOf("2026-10-27")).toBeNull();
    expect(clockOf(null)).toBeNull();
  });

  it("writes a day with or without a time", () => {
    const day = new Date(2026, 9, 27);
    expect(storedOf(day, null)).toBe("2026-10-27");
    expect(storedOf(day, { hour: 14, minute: 30 })).toBe("2026-10-27T14:30");
  });
});

describe("quickDays", () => {
  it("offers today, tomorrow and the coming Monday", () => {
    expect(quickDays(today).map(({ label, day }) => [label, isoOf(day)])).toEqual([
      ["Today", "2026-10-26"],
      ["Tomorrow", "2026-10-27"],
      ["Next week", "2026-11-02"],
    ]);
  });

  it("takes next week from a Sunday to the next day", () => {
    const sunday = new Date(2026, 10, 1);
    expect(isoOf(quickDays(sunday)[2].day)).toBe("2026-11-02");
  });
});

describe("monthRows", () => {
  it("lays October 2026 out in weeks from Sunday", () => {
    const rows = monthRows(new Date(2026, 9, 1));
    // 1 October 2026 is a Thursday: four blanks, then the days.
    expect(rows[0].map((cell) => cell?.getDate() ?? null)).toEqual([
      null, null, null, null, 1, 2, 3,
    ]);
    expect(rows).toHaveLength(5);
    expect(rows.at(-1)?.map((cell) => cell?.getDate() ?? null)).toEqual([
      25, 26, 27, 28, 29, 30, 31,
    ]);
  });
});

describe("the twelve hour face", () => {
  it("round trips every hour of the day", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(dayHour(faceHour(hour), hour >= 12)).toBe(hour);
    }
    expect(faceHour(0)).toBe(12);
    expect(faceHour(13)).toBe(1);
  });
});
