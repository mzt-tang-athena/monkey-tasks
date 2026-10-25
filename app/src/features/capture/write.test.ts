import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { captureContent } from "./write";

import type { ParsedCapture } from "./parse";

const CREATED = "2026-10-25T14:03";

const sample: ParsedCapture = {
  name: "water the plants",
  due: "2026-10-21T07:30",
  recurrence: "FREQ=DAILY;INTERVAL=2",
  reminders: ["2026-10-21T07:30"],
};

/** What a standard YAML parser makes of the note capture wrote. */
function parsed(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) {
    throw new Error("no frontmatter block");
  }
  return load(match[1]) as Record<string, unknown>;
}

describe("captureContent", () => {
  it("writes the frontmatter only, no replacement surgery", () => {
    const text = captureContent(sample, undefined, CREATED);
    expect(text).toBe(
      [
        "---",
        'kind: "[[tasks]]"',
        `created: ${CREATED}`,
        "due: 2026-10-21T07:30",
        "reminders:",
        "  - 2026-10-21T07:30",
        'recurrence: "FREQ=DAILY;INTERVAL=2"',
        "---",
        "",
      ].join("\n") + "\n",
    );
  });

  it("emits the lists property natively for a list target", () => {
    const text = captureContent(sample, "Focus");
    expect(text).toContain("lists:");
    expect(text).toContain('  - "[[Focus]]"');
    expect(text.indexOf("lists:")).toBeGreaterThan(
      text.indexOf("due:"),
    );
    expect(text.trimEnd().endsWith("---")).toBe(true);
  });

  it("writes no lists property for the Main target", () => {
    expect(captureContent(sample)).not.toContain("lists:");
  });

  it("reads back through js-yaml as the values the row holds", () => {
    const data = parsed(captureContent(sample, "Focus", CREATED));
    expect(data).toEqual({
      kind: "[[tasks]]",
      created: CREATED,
      due: "2026-10-21T07:30",
      lists: ["[[Focus]]"],
      reminders: ["2026-10-21T07:30"],
      recurrence: "FREQ=DAILY;INTERVAL=2",
    });
  });

  it("writes a one-item list as a block that js-yaml reads as a list", () => {
    const text = captureContent(sample);
    expect(text).toContain("reminders:\n  - 2026-10-21T07:30");
    expect(text).not.toContain("reminders:   -");
    expect(parsed(text).reminders).toEqual(["2026-10-21T07:30"]);
  });

  it("writes several list items as strings, not nested arrays", () => {
    const text = captureContent(
      { ...sample, reminders: ["2026-10-21T07:30", "2026-10-21T19:00"] },
      "Focus",
    );
    expect(parsed(text).lists).toEqual(["[[Focus]]"]);
    expect(parsed(text).reminders).toEqual([
      "2026-10-21T07:30",
      "2026-10-21T19:00",
    ]);
  });
});
