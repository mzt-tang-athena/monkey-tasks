import { describe, expect, it } from "vitest";
import type { TaskEdit } from "@/types/task";
import { bodyOf, noteLines, noteText, PROPERTIES } from "./model";

const today = new Date(2026, 9, 26, 9, 0);

function draft(overrides: Partial<TaskEdit> = {}): TaskEdit {
  return {
    name: "Call Mum",
    due: null,
    recurrence: null,
    list: null,
    reminders: [],
    alertWeight: "harsh",
    body: "",
    ...overrides,
  };
}

const alerts = PROPERTIES.find((property) => property.key === "alerts")!;
const due = PROPERTIES.find((property) => property.key === "due")!;
const note = PROPERTIES.find((property) => property.key === "note")!;
const reference = PROPERTIES.find((property) => property.key === "reference")!;

describe("the property registry", () => {
  it("keeps the order Status, Due, Repeat, Alerts, Reference, Note", () => {
    expect(PROPERTIES.map((property) => property.key)).toEqual([
      "status",
      "due",
      "repeat",
      "alerts",
      "reference",
      "note",
    ]);
  });
});

describe("alerts", () => {
  it("reads a timed due as at due, then its reminders", () => {
    const held = draft({
      due: "2026-10-27T09:00",
      reminders: ["2026-10-27T12:30"],
    });

    expect(alerts.words(held, today)).toBe("At due, 12:30 PM");
    expect(alerts.isSet(held)).toBe(true);
  });

  it("names the day of a reminder that falls on another day than the due", () => {
    const held = draft({
      due: "2026-10-27T09:00",
      reminders: ["2026-10-26T18:00"],
    });

    expect(alerts.words(held, today)).toBe("At due, Today 6:00 PM");
  });

  it("names the timed due alone when it holds no reminder", () => {
    expect(alerts.words(draft({ due: "2026-10-27T09:00" }), today)).toBe(
      "At due",
    );
  });

  it("collapses a long list to its first line and a count", () => {
    const held = draft({
      reminders: ["2026-10-27T09:00", "2026-10-28T09:00", "2026-10-29T09:00"],
    });

    expect(alerts.words(held, today)).toBe("Tomorrow 9:00 AM and 2 more");
  });

  it("adds Alarm after the alerts of an alarm task, and nothing for a normal one", () => {
    expect(alerts.aside?.(draft({ alertWeight: "harsh" }))).toBe("Alarm");
    expect(alerts.aside?.(draft({ alertWeight: "quiet" }))).toBeNull();
  });

  it("clears only the reminders, never a timed due", () => {
    expect(alerts.clear(draft({ due: "2026-10-27T09:00" }))).toBeNull();
    expect(
      alerts.clear(draft({ reminders: ["2026-10-27T09:00"] })),
    ).toEqual({ reminders: [] });
  });
});

describe("a reference", () => {
  it("is set only while a link sits under the heading", () => {
    expect(reference.isSet(draft())).toBe(false);
    expect(
      reference.isSet(draft({ body: "\n## Reference\n\n[[oatmeal]]\n" })),
    ).toBe(true);
    expect(reference.isSet(draft({ body: "\nAte [[oatmeal]].\n" }))).toBe(false);
  });

  it("reads its links as words and clears only from its own rows", () => {
    const held = draft({
      body: "\n## Reference\n\n[[oatmeal]]\n[[miso-soup]]\n",
    });

    expect(reference.words(held, today)).toBe("oatmeal, miso-soup");
    expect(reference.clear(held)).toBeNull();
  });

  it("keeps the links out of the note's preview lines", () => {
    expect(
      noteLines("\nBuy oats\n\n## Reference\n\n[[oatmeal]]\n"),
    ).toBe("Buy oats");
  });

  it("does not count a reference section as a note", () => {
    expect(note.isSet(draft({ body: "\n## Reference\n\n[[oatmeal]]\n" }))).toBe(
      false,
    );
  });
});

describe("a due and a note", () => {
  it("sets the due only when the draft has one", () => {
    expect(due.isSet(draft())).toBe(false);
    expect(due.clear(draft())).toEqual({ due: null });
  });

  it("keeps a note's first two lines with text", () => {
    expect(noteLines("\n\nBuy stamps\nand milk\nand eggs\n")).toBe(
      "Buy stamps\nand milk",
    );
    expect(note.isSet(draft({ body: "\n" }))).toBe(false);
    expect(note.clear(draft({ body: "\nA note\n" }))).toBeNull();
  });

  it("reads the body without its blank lines and writes one blank line", () => {
    expect(noteText("\nBuy stamps\n")).toBe("Buy stamps");
    expect(bodyOf("Buy stamps\n")).toBe("\nBuy stamps\n");
    expect(bodyOf("  ")).toBe("");
  });
});
