import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { updateProperty } from "./frontmatter";

const base =
  '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nlists:\n---\n\nbody\n';

/** What a standard YAML parser makes of the frontmatter block. */
function parsed(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) {
    throw new Error("no frontmatter block");
  }
  return load(match[1]) as Record<string, unknown>;
}

describe("updateProperty", () => {
  it("replaces a single-line property", () => {
    const result = updateProperty(
      base,
      "created",
      "2026-10-21",
    );
    expect(result).toContain("created: 2026-10-21");
    expect(result).not.toContain("2026-10-20\n---");
  });

  it("writes list values in block style", () => {
    const result = updateProperty(base, "lists", ["[[groceries]]"]);
    expect(result).toContain('lists:\n  - "[[groceries]]"');
  });

  it("inserts a one-item array as a block, never inline", () => {
    const minimal = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n';
    const result = updateProperty(minimal, "reminders", ["2026-11-01T07:00"]);
    expect(result).toContain("reminders:\n  - 2026-11-01T07:00");
    expect(result).not.toContain("reminders:   -");
    expect(parsed(result).reminders).toEqual(["2026-11-01T07:00"]);
  });

  it("quotes a wikilink item so js-yaml reads a list of strings", () => {
    const result = updateProperty(base, "lists", ["[[groceries]]"]);
    expect(parsed(result).lists).toEqual(["[[groceries]]"]);
  });

  it("quotes every wikilink item in a multi-item list", () => {
    const result = updateProperty(base, "lists", ["[[home]]", "[[errands]]"]);
    expect(parsed(result).lists).toEqual(["[[home]]", "[[errands]]"]);
  });

  it("quotes a wikilink scalar", () => {
    const minimal = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n';
    const result = updateProperty(minimal, "list", "[[Focus]]");
    expect(result).toContain('list: "[[Focus]]"');
    expect(parsed(result).list).toBe("[[Focus]]");
  });

  it("leaves a date and an RRULE unquoted", () => {
    const minimal = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n';
    const dated = updateProperty(minimal, "completed", "2026-10-21");
    expect(dated).toContain("completed: 2026-10-21");
    const recurring = updateProperty(
      dated,
      "recurrence",
      "FREQ=WEEKLY;INTERVAL=2",
    );
    expect(recurring).toContain("recurrence: FREQ=WEEKLY;INTERVAL=2");
    expect(parsed(recurring)).toMatchObject({
      created: "2026-10-20",
      completed: "2026-10-21",
      recurrence: "FREQ=WEEKLY;INTERVAL=2",
    });
  });

  it("removes a property and its block items", () => {
    const withDue =
      '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\ndue: 2026-10-21T15:00\nreminders:\n  - 2026-10-21T15:00\n---\n';
    const result = updateProperty(withDue, "reminders", null);
    expect(result).not.toContain("reminders");
    expect(result).toContain("due: 2026-10-21T15:00");
  });

  it("inserts a missing property before the closing fence", () => {
    const minimal = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n';
    const result = updateProperty(minimal, "completed", "2026-10-21");
    expect(result).toContain("completed: 2026-10-21");
    expect(result.indexOf("completed")).toBeGreaterThan(
      result.indexOf("created"),
    );
  });

  it("preserves unknown properties untouched", () => {
    const withPlugin =
      '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nplugin_prop: {"a": 1}\n---\n';
    const result = updateProperty(withPlugin, "completed", "2026-10-21");
    expect(result).toContain('plugin_prop: {"a": 1}');
  });

  it("clearing an absent property is a no-op", () => {
    const result = updateProperty(base, "completed", null);
    expect(result).toBe(base);
  });
});
