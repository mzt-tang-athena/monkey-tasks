import { describe, expect, it } from "vitest";
import { parseCapture } from "./parse";

// Fixed "now": Monday 2026-10-19, local time.
const now = new Date(2026, 9, 19, 12, 0, 0);

describe("parseCapture", () => {
  it("parses the acceptance example fully", () => {
    const result = parseCapture("call the dentist tuesday 3pm repeat monthly", now);
    expect(result?.name).toBe("call the dentist");
    expect(result?.due).toBe("2026-10-20T15:00");
    expect(result?.recurrence).toBe("FREQ=MONTHLY");
    expect(result?.reminders).toEqual(["2026-10-20T15:00"]);
  });

  it("strips the remind-me-to prefix and recurring keyword", () => {
    const result = parseCapture("remind me to go to the dentist recurring monthly", now);
    expect(result?.name).toBe("go to the dentist");
    expect(result?.recurrence).toBe("FREQ=MONTHLY");
  });

  it("keeps an undateable line as a name-only task", () => {
    const result = parseCapture("sort out the brake pads before the road trip", now);
    expect(result?.name).toBe("sort out the brake pads before the road trip");
    expect(result?.due).toBeUndefined();
    expect(result?.recurrence).toBeUndefined();
  });

  it("parses a bare date", () => {
    const result = parseCapture("file taxes friday", now);
    expect(result?.name).toBe("file taxes");
    expect(result?.due).toBe("2026-10-23");
    expect(result?.reminders).toBeUndefined();
  });

  it("maps explicit repeat words", () => {
    expect(parseCapture("take the bins out repeat weekly", now)?.recurrence).toBe("FREQ=WEEKLY");
    expect(parseCapture("check servers repeat daily", now)?.recurrence).toBe("FREQ=DAILY");
    expect(parseCapture("review insurance repeat yearly", now)?.recurrence).toBe("FREQ=YEARLY");
  });

  it("parses every-phrases with intervals", () => {
    const result = parseCapture("water the plants every other day", now);
    expect(result?.name).toBe("water the plants");
    expect(result?.recurrence).toBe("FREQ=DAYS;INTERVAL=2");
  });

  it("parses every weekday", () => {
    const result = parseCapture("clean the kitchen every wednesday", now);
    expect(result?.name).toBe("clean the kitchen");
    expect(result?.recurrence).toBe("FREQ=WEEKLY;BYDAY=WE");
  });

  it("falls back to the whole line when everything matches", () => {
    const result = parseCapture("tomorrow", now);
    expect(result?.name).toBe("tomorrow");
    expect(result?.due).toBe("2026-10-20");
  });

  it("returns null for empty input", () => {
    expect(parseCapture("   ", now)).toBeNull();
  });
});
