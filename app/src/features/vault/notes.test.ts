import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "js-yaml";
import { serializeValue } from "../../lib/yaml";

const fs = vi.hoisted(() => ({
  read: "",
  readError: null as Error | null,
  write: vi.fn(),
  created: "draw.md",
}));

vi.mock("expo-file-system/legacy", () => ({
  EncodingType: { UTF8: "utf8" },
  StorageAccessFramework: {
    createFileAsync: async (_folder: string, fileName: string) =>
      `content://vault/Tasks/${encodeURIComponent(
        fs.created === "" ? fileName : fs.created,
      )}`,
  },
  readAsStringAsync: async () => {
    if (fs.readError) {
      throw fs.readError;
    }
    return fs.read;
  },
  writeAsStringAsync: fs.write,
}));

import {
  createNote,
  NoteChangedError,
  NoteUnreadableError,
  updateProperty,
  writeNoteIfUnchanged,
} from "./notes";

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

describe("serializeValue", () => {
  it("quotes what YAML would read as something else, and nothing else", () => {
    expect(serializeValue("[[Focus]]")).toBe('"[[Focus]]"');
    expect(serializeValue(["[[a]]", "[[b]]"])).toBe(
      '  - "[[a]]"\n  - "[[b]]"',
    );
    expect(serializeValue(["2026-11-01T07:00"])).toBe(
      "  - 2026-11-01T07:00",
    );
    expect(serializeValue("2026-10-21")).toBe("2026-10-21");
    // Free text: a colon, a leading indicator, or a value YAML would
    // read as a boolean or a number.
    expect(serializeValue("Call: mom")).toBe('"Call: mom"');
    expect(serializeValue("#1 thing")).toBe('"#1 thing"');
    expect(serializeValue("true")).toBe('"true"');
    expect(serializeValue("123")).toBe('"123"');
    expect(serializeValue("draw (1)")).toBe("draw (1)");
  });

  it("reads every quoted value back unchanged", () => {
    for (const value of ["Call: mom", "#1 thing", "true", "123", "a # b"]) {
      expect(parsed(`---\ntitle: ${serializeValue(value)}\n---\n`).title).toBe(
        value,
      );
    }
  });
});

describe("createNote", () => {
  beforeEach(() => {
    fs.created = "";
    fs.write.mockClear();
  });

  it("writes the note and returns the name it got", async () => {
    const created = await createNote(
      "content://vault/Tasks",
      "draw.md",
      '---\ncreated: 2026-10-25\n---\n',
    );
    expect(created.fileName).toBe("draw.md");
    expect(created.text).not.toContain("title:");
  });

  it("adds the requested title when the provider renames the file", async () => {
    fs.created = "draw (1).md";
    const created = await createNote(
      "content://vault/Tasks",
      "draw.md",
      '---\ncreated: 2026-10-25\n---\n',
      "draw",
    );
    expect(created.fileName).toBe("draw (1).md");
    expect(created.text).toContain("title: draw");
    expect(parsed(created.text).title).toBe("draw");
    // The text that was written is the text that is returned.
    expect(fs.write.mock.calls[0]?.slice(0, 2)).toEqual([
      created.uri,
      created.text,
    ]);
  });

  it("adds the typed name as the title when the file name was cleaned", async () => {
    const created = await createNote(
      "content://vault/Tasks",
      "Pay bill water.md",
      '---\ncreated: 2026-10-25\n---\n',
      "Pay bill: water",
    );
    expect(created.fileName).toBe("Pay bill water.md");
    expect(parsed(created.text).title).toBe("Pay bill: water");
  });

  it("writes no title when the file name holds the typed name", async () => {
    const created = await createNote(
      "content://vault/Tasks",
      "draw.md",
      '---\ncreated: 2026-10-25\n---\n',
      "draw",
    );
    expect(created.text).not.toContain("title:");
  });
});

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

describe("writeNoteIfUnchanged", () => {
  beforeEach(() => {
    fs.read = "";
    fs.readError = null;
    fs.write.mockClear();
  });

  it("writes when the file still holds the text it read", async () => {
    fs.read = "old";

    await writeNoteIfUnchanged("content://x", "old", "new");

    expect(fs.write).toHaveBeenCalledWith("content://x", "new", {
      encoding: "utf8",
    });
  });

  it("refuses when another writer changed the file", async () => {
    fs.read = "theirs";

    await expect(
      writeNoteIfUnchanged("content://x", "ours", "new"),
    ).rejects.toBeInstanceOf(NoteChangedError);

    expect(fs.write).not.toHaveBeenCalled();
  });

  it("refuses when the file cannot be read", async () => {
    fs.readError = new Error("gone");

    await expect(
      writeNoteIfUnchanged("content://x", "ours", "new"),
    ).rejects.toBeInstanceOf(NoteUnreadableError);

    expect(fs.write).not.toHaveBeenCalled();
  });
});
