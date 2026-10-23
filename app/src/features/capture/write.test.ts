import { describe, expect, it } from "vitest";
import { captureContent } from "./write";
import { todayIso } from "../../lib/dates";
import type { ParsedCapture } from "./parse";

const sample: ParsedCapture = {
  name: "water the plants",
  due: "2026-10-21T07:30",
  recurrence: "FREQ=DAILY;INTERVAL=2",
  reminders: ["2026-10-21T07:30"],
};

describe("captureContent", () => {
  it("writes the frontmatter only, no replacement surgery", () => {
    const text = captureContent(sample);
    expect(text).toBe(
      [
        "---",
        'kind: "[[tasks]]"',
        `created: ${todayIso()}`,
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
    expect(text).toContain("  - [[Focus]]");
    expect(text.indexOf("lists:")).toBeGreaterThan(
      text.indexOf("due:"),
    );
    expect(text.trimEnd().endsWith("---")).toBe(true);
  });

  it("writes no lists property for the Main target", () => {
    expect(captureContent(sample)).not.toContain("lists:");
  });
});
