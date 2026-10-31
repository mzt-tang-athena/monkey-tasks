import { describe, expect, it } from "vitest";
import { PREVIEW_SEEDS, SAMPLE_DAY, daysBetween, sampleSeed, shiftDates } from "./seed";

describe("daysBetween", () => {
  it("counts whole days, across a month and a daylight saving change", () => {
    expect(daysBetween("2026-10-26", "2026-10-26")).toBe(0);
    expect(daysBetween("2026-10-26", "2026-11-02")).toBe(7);
    expect(daysBetween("2026-10-26", "2026-09-27")).toBe(-29);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("shiftDates", () => {
  const note = [
    "---",
    'kind: "[[tasks]]"',
    'title: "Due 2026-10-26: pay"',
    "created: 2026-10-26T09:00",
    "due: 2026-10-31T19:00",
    "completed: 2026-10-25",
    "reminders:",
    "  - 2026-10-26T08:00",
    "---",
    "",
    "Body from 2026-10-26.",
    "",
  ].join("\n");

  it("moves every date value in the frontmatter and keeps the time", () => {
    const moved = shiftDates(note, 3);

    expect(moved).toContain("created: 2026-10-29T09:00");
    expect(moved).toContain("due: 2026-11-03T19:00");
    expect(moved).toContain("completed: 2026-10-28");
    expect(moved).toContain("  - 2026-10-29T08:00");
  });

  it("leaves the body and quoted text alone", () => {
    const moved = shiftDates(note, 3);

    expect(moved).toContain('title: "Due 2026-10-26: pay"');
    expect(moved).toContain("Body from 2026-10-26.");
  });

  it("changes nothing on the sample day", () => {
    expect(shiftDates(note, 0)).toBe(note);
  });
});

describe("sampleSeed", () => {
  it("holds the preview's sample with no move on the sample day", () => {
    const seed = sampleSeed(PREVIEW_SEEDS, SAMPLE_DAY);

    expect(Object.keys(seed)).toHaveLength(27);
    expect(seed["Tasks/Supplements.md"]).toContain("recurrence: FREQ=DAILY");
    expect(seed["Tasks/Supplements.md"]).toContain("due: 2026-10-26T19:00");
    expect(seed["Tasks/Broken note.md"]).toBeDefined();
    expect(seed["Tasks/Lists/Garden.md"]).toBeDefined();
  });

  it("keeps the typed name of a task whose name a file cannot hold", () => {
    const seed = sampleSeed(["default"], SAMPLE_DAY);

    expect(seed["Tasks/Groceries milk, eggs, oats.md"]).toContain(
      'title: "Groceries: milk, eggs, oats"',
    );
  });

  it("moves the sample to today, so every group stays full", () => {
    const seed = sampleSeed(["default"], "2026-12-01");

    expect(seed["Tasks/Supplements.md"]).toContain("due: 2026-12-01T19:00");
    expect(seed["Tasks/Return library books.md"]).toContain("due: 2026-11-30");
  });

  it("names the seeds it has when asked for one it does not", () => {
    expect(() => sampleSeed(["nope"], SAMPLE_DAY)).toThrow(
      'no sample vault "nope": pick from default, repair',
    );
  });
});
