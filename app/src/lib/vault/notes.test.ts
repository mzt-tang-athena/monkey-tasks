import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { serializeValue } from "@/utils/yaml";
import { MEMORY_ROOT, createMemoryVault } from "./adapters/memory";
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


const TASKS = `${MEMORY_ROOT}/Tasks`;
const NOTE = "---\ncreated: 2026-10-25\n---\n";

describe("createNote", () => {
  it("writes the note and returns the name it got", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "call" });

    const created = await createNote(vault, TASKS, "draw.md", NOTE);

    expect(created.fileName).toBe("draw.md");
    expect(created.text).not.toContain("title:");
    expect(vault.hooks.read("Tasks/draw.md")).toBe(created.text);
  });

  it("adds the requested title when the provider renames the file", async () => {
    const vault = createMemoryVault({ "Tasks/draw.md": "taken" });

    const created = await createNote(vault, TASKS, "draw.md", NOTE, "draw");

    expect(created.fileName).toBe("draw (1).md");
    expect(created.text).toContain("title: draw");
    expect(parsed(created.text).title).toBe("draw");
    // The text that was written is the text that is returned.
    expect(vault.hooks.read("Tasks/draw (1).md")).toBe(created.text);
  });

  it("takes the new file away when the title cannot be written", async () => {
    const vault = createMemoryVault({ "Tasks/draw.md": "taken" });
    vault.hooks.failNext("write", "draw (1).md");

    await expect(
      createNote(vault, TASKS, "draw.md", NOTE, "draw"),
    ).rejects.toThrow();

    expect(vault.hooks.files()).toEqual({ "Tasks/draw.md": "taken" });
  });

  it("adds the typed name as the title when the file name was cleaned", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "call" });

    const created = await createNote(
      vault,
      TASKS,
      "Pay bill water.md",
      NOTE,
      "Pay bill: water",
    );

    expect(created.fileName).toBe("Pay bill water.md");
    expect(parsed(created.text).title).toBe("Pay bill: water");
    expect(vault.hooks.read("Tasks/Pay bill water.md")).toBe(created.text);
  });

  it("writes no title when the file name holds the typed name", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "call" });

    const created = await createNote(vault, TASKS, "draw.md", NOTE, "draw");

    expect(created.text).not.toContain("title:");
  });
});

describe("writeNoteIfUnchanged", () => {
  const CALL = `${TASKS}/Call.md`;

  it("writes when the file still holds the text it read", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "old" });

    await writeNoteIfUnchanged(vault, CALL, "old", "new");

    expect(vault.hooks.read("Tasks/Call.md")).toBe("new");
  });

  it("refuses when another writer changed the file", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "theirs" });

    await expect(
      writeNoteIfUnchanged(vault, CALL, "ours", "new"),
    ).rejects.toBeInstanceOf(NoteChangedError);

    expect(vault.hooks.read("Tasks/Call.md")).toBe("theirs");
  });

  it("refuses when the file cannot be read", async () => {
    const vault = createMemoryVault({ "Tasks/Bread.md": "bread" });

    await expect(
      writeNoteIfUnchanged(vault, CALL, "ours", "new"),
    ).rejects.toBeInstanceOf(NoteUnreadableError);

    expect(vault.hooks.files()).toEqual({ "Tasks/Bread.md": "bread" });
  });
});
