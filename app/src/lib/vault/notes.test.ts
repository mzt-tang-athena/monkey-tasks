import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "js-yaml";
import { serializeValue } from "@/utils/yaml";

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
  writeNoteIfUnchanged,
} from "./notes";

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
