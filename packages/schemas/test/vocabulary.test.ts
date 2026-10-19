import { describe, expect, it } from "vitest";
import {
  deedFrontmatter,
  deedIsDone,
  listFrontmatter,
  taskFrontmatter,
  taskIsDone,
  validateNote,
  wikilinkTarget,
} from "../src/index.js";
import { parseFrontmatter } from "../src/frontmatter.js";

describe("taskFrontmatter", () => {
  it("accepts a minimal task note", () => {
    const result = taskFrontmatter.safeParse({
      kind: "[[tasks]]",
      created: "2026-10-19",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full task note and preserves unknown properties", () => {
    const result = taskFrontmatter.safeParse({
      kind: "[[tasks]]",
      created: "2026-10-19",
      completed: "2026-10-20",
      due: "2026-10-21",
      reminders: ["2026-10-21T14:50", "2026-10-21T15:00"],
      recurrence: "FREQ=MONTHLY",
      lists: ["[[groceries]]"],
      "obsidian-plugin-noise": { deep: true },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recurrence).toBe("FREQ=MONTHLY");
      expect(result.data["obsidian-plugin-noise"]).toEqual({ deep: true });
    }
  });

  it("rejects a task with a broken recurrence", () => {
    const result = taskFrontmatter.safeParse({
      kind: "[[tasks]]",
      created: "2026-10-19",
      recurrence: "monthly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a task with a malformed date", () => {
    const result = taskFrontmatter.safeParse({
      kind: "[[tasks]]",
      created: "19-10-2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("taskIsDone", () => {
  it("derives done from the completed date", () => {
    const open = taskFrontmatter.parse({ kind: "[[tasks]]", created: "2026-10-19" });
    const done = taskFrontmatter.parse({
      kind: "[[tasks]]",
      created: "2026-10-19",
      completed: "2026-10-20",
    });
    expect(taskIsDone(open)).toBe(false);
    expect(taskIsDone(done)).toBe(true);
  });
});

describe("deedFrontmatter", () => {
  it("accepts an existing deed note as it is stored today", () => {
    const result = deedFrontmatter.safeParse({
      kind: "[[deeds]]",
      status: "[[backlog]]",
      created: "2026-09-07",
      categories: ["[[digital]]"],
      after: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty list properties from the template", () => {
    const result = deedFrontmatter.safeParse({
      kind: "[[deeds]]",
      status: "[[backlog]]",
      categories: null,
      types: null,
      "do after": null,
    });
    // "do after" is the template's stale key name; the loose schema
    // preserves it. The rename is ticket 0005's job.
    expect(result.success).toBe(true);
  });

  it("accepts both after and blocked by until the 0005 rename", () => {
    for (const key of ["after", "blocked by"]) {
      const result = deedFrontmatter.safeParse({
        kind: "[[deeds]]",
        status: "[[active]]",
        [key]: ["[[gather quarterly notes]]"],
      });
      expect(result.success).toBe(true);
    }
  });

  it("tolerates a bare status from older notes and wraps it", () => {
    const result = deedFrontmatter.safeParse({
      kind: "[[deeds]]",
      status: "backlog",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("[[backlog]]");
    }
  });

  it("normalizes a single after value into a list", () => {
    const result = deedFrontmatter.safeParse({
      kind: "[[deeds]]",
      status: "[[active]]",
      after: "[[create a recurring checklist template]]",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.after).toEqual(["[[create a recurring checklist template]]"]);
    }
  });

  it("wraps a bare parent deed value", () => {
    const result = deedFrontmatter.safeParse({
      kind: "[[deeds]]",
      "parent deed": "meal-prep-system",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data["parent deed"]).toBe("[[meal-prep-system]]");
    }
  });

  it("accepts a sub-deed with no status and a parent deed", () => {
    const result = deedFrontmatter.safeParse({
      kind: "[[deeds]]",
      "parent deed": "[[tower-defence-game]]",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = deedFrontmatter.safeParse({
      kind: "[[deeds]]",
      status: "[[paused]]",
    });
    expect(result.success).toBe(false);
  });

  it("derives done from status", () => {
    const done = deedFrontmatter.parse({
      kind: "[[deeds]]",
      status: "[[done]]",
      completed: "2026-10-19",
    });
    const active = deedFrontmatter.parse({
      kind: "[[deeds]]",
      status: "[[active]]",
    });
    expect(deedIsDone(done)).toBe(true);
    expect(deedIsDone(active)).toBe(false);
  });
});

describe("listFrontmatter", () => {
  it("accepts a minimal list note", () => {
    const result = listFrontmatter.safeParse({
      kind: "[[lists]]",
      created: "2026-10-19",
    });
    expect(result.success).toBe(true);
  });
});

describe("parseFrontmatter", () => {
  it("parses a real deed note", () => {
    const text = [
      "---",
      'kind: "[[deeds]]"',
      'status: "[[backlog]]"',
      "created: 2026-09-07",
      "categories:",
      '  - "[[digital]]"',
      "after:",
      "---",
      "",
      "## Context",
      "",
      "- Switch back to Floorp",
      "",
    ].join("\n");
    const parsed = parseFrontmatter("deed browser set up.md", text);
    expect(parsed.title).toBe("deed browser set up");
    expect(parsed.values.kind).toBe("[[deeds]]");
    expect(parsed.values.categories).toEqual(["[[digital]]"]);
    expect(parsed.values.after).toBeNull();
    expect(parsed.body).toContain("## Context");
  });

  it("keeps unknown rich values as raw strings", () => {
    const text = [
      "---",
      "kind: \"[[tasks]]\"",
      "created: 2026-10-19",
      "tags:",
      "  - kind",
      "---",
      "body",
    ].join("\n");
    const parsed = parseFrontmatter("x.md", text);
    expect(parsed.values.tags).toEqual(["kind"]);
  });

  it("returns the body when frontmatter is missing", () => {
    const parsed = parseFrontmatter("note.md", "just text");
    expect(parsed.values).toEqual({});
    expect(parsed.body).toBe("just text");
    expect(parsed.title).toBe("note");
  });
});

describe("validateNote", () => {
  it("returns data on a valid note and errors on an invalid one", () => {
    const good = validateNote(
      "call the dentist.md",
      '---\nkind: "[[tasks]]"\ncreated: 2026-10-19\ndue: 2026-10-21\n---\n',
      taskFrontmatter,
    );
    expect(good.data?.due).toBe("2026-10-21");
    expect(good.errors).toBeNull();

    const bad = validateNote(
      "broken.md",
      '---\nkind: "[[tasks]]"\ncreated: nope\n---\n',
      taskFrontmatter,
    );
    expect(bad.data).toBeNull();
    expect(bad.errors).not.toBeNull();
    expect(bad.note.title).toBe("broken");
  });
});

describe("wikilinkTarget", () => {
  it("extracts the target", () => {
    expect(wikilinkTarget("[[groceries]]")).toBe("groceries");
  });
});
