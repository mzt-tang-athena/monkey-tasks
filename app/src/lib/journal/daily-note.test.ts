import { describe, expect, it } from "vitest";
import { createMemoryVault, MEMORY_ROOT } from "@/lib/vault/adapters/memory";
import { NoteChangedError } from "@/lib/vault/notes";
import { appendEntry, readDailyNote } from "./daily-note";
import { readReference } from "./reference";

const day = "2026-10-26";
const path = "Journal/Daily/2026-10-26.md";
const block = "09:05\n- one\n- two";

describe("readDailyNote", () => {
  it("reads a missing note as empty and creates nothing", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "x" });
    expect(await readDailyNote(vault, MEMORY_ROOT, day)).toBe("");
    expect(Object.keys(vault.hooks.files())).toEqual(["Tasks/Call.md"]);
  });

  it("reads the note byte for byte", async () => {
    const vault = createMemoryVault({ [path]: "8:00\r\n- up\r\n" });
    expect(await readDailyNote(vault, MEMORY_ROOT, day)).toBe("8:00\r\n- up\r\n");
  });
});

describe("appendEntry", () => {
  it("creates the folders and the note on the first send", async () => {
    const vault = createMemoryVault({});
    const result = await appendEntry(vault, MEMORY_ROOT, { day, block });
    expect(result).toEqual({ text: "09:05\n- one\n- two\n", appended: true });
    expect(vault.hooks.files()).toEqual({ [path]: "09:05\n- one\n- two\n" });
  });

  it("appends to the existing note before its embed", async () => {
    const vault = createMemoryVault({ [path]: "8:00\n- up\n\n![[daily.base]]\n" });
    await appendEntry(vault, MEMORY_ROOT, { day, block });
    expect(vault.hooks.read(path)).toBe(
      "8:00\n- up\n\n09:05\n- one\n- two\n\n![[daily.base]]\n",
    );
  });

  it("appends to the note that won a create race and drops its own copy", async () => {
    let raced = false;
    const vault = createMemoryVault(
      {},
      {
        fail(op) {
          if (op === "create" && !raced) {
            raced = true;
            vault.hooks.write(path, "8:00\n- from obsidian\n");
          }
          return null;
        },
      },
    );
    await appendEntry(vault, MEMORY_ROOT, { day, block });
    expect(vault.hooks.files()).toEqual({
      [path]: "8:00\n- from obsidian\n\n09:05\n- one\n- two\n",
    });
  });

  it("refuses to write over a change made between the read and the write", async () => {
    let reads = 0;
    const vault = createMemoryVault(
      { [path]: "8:00\n- up\n" },
      {
        fail(op) {
          if (op === "read" && ++reads === 2) {
            vault.hooks.write(path, "8:00\n- up\n- edited\n");
          }
          return null;
        },
      },
    );
    await expect(appendEntry(vault, MEMORY_ROOT, { day, block })).rejects.toBeInstanceOf(
      NoteChangedError,
    );
    expect(vault.hooks.read(path)).toBe("8:00\n- up\n- edited\n");
  });

  it("does not write a retry whose first try landed", async () => {
    const vault = createMemoryVault({ [path]: "8:00\n- up\n\n09:05\n- one\n- two\n" });
    const result = await appendEntry(vault, MEMORY_ROOT, { day, block, retry: true });
    expect(result.appended).toBe(false);
    expect(vault.hooks.read(path)).toBe("8:00\n- up\n\n09:05\n- one\n- two\n");
  });
});

describe("readReference", () => {
  it("reads the body below the frontmatter", async () => {
    const vault = createMemoryVault({ "References/oatmeal.md": "---\nkind: food\n---\nRolled oats.\n" });
    expect(await readReference(vault, MEMORY_ROOT, "Oatmeal")).toBe("Rolled oats.\n");
  });

  it("answers null for a missing note", async () => {
    const vault = createMemoryVault({});
    expect(await readReference(vault, MEMORY_ROOT, "oatmeal")).toBeNull();
  });
});
