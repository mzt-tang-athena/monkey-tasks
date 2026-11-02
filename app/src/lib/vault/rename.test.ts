import { describe, expect, it } from "vitest";
import { MEMORY_ROOT, createMemoryVault } from "./adapters/memory";
import { NoteChangedError } from "./notes";
import { renameNote } from "./rename";

const CALL = `${MEMORY_ROOT}/Tasks/Call.md`;
const TEXT = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n';

describe("renameNote", () => {
  it("creates the new file beside the old one, then removes the old one", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": TEXT });

    const renamed = await renameNote(vault, CALL, "Call Mum.md", TEXT, TEXT, "Call Mum");

    expect(renamed.fileName).toBe("Call Mum.md");
    expect(vault.hooks.files()).toEqual({ "Tasks/Call Mum.md": TEXT });
  });

  it("refuses when another writer changed the note", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": `${TEXT}\nEdited.\n` });

    await expect(
      renameNote(vault, CALL, "Call Mum.md", TEXT, TEXT, "Call Mum"),
    ).rejects.toBeInstanceOf(NoteChangedError);

    expect(Object.keys(vault.hooks.files())).toEqual(["Tasks/Call.md"]);
  });

  it("keeps only the old note when the old file cannot be removed", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": TEXT });
    vault.hooks.failNext("remove", "Call.md");

    await expect(
      renameNote(vault, CALL, "Call Mum.md", TEXT, TEXT, "Call Mum"),
    ).rejects.toThrow("remove failed");

    expect(vault.hooks.files()).toEqual({ "Tasks/Call.md": TEXT });
  });
});
