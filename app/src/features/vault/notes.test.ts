import { describe, expect, it } from "vitest";
import { updateProperty } from "./notes";

const base =
  '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nlists:\n---\n\nbody\n';

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
    expect(result).toContain("lists:\n  - [[groceries]]");
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
