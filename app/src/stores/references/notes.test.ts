import { describe, expect, it } from "vitest";
import { createMemoryVault, MEMORY_ROOT } from "@/lib/vault/adapters/memory";
import { loadReferences, referenceOf } from "./notes";

const OATMEAL = [
  "---",
  'kind: "[[references]]"',
  "ingredients:",
  "  - oats",
  "  - milk",
  "categories:",
  '  - "[[Waypoints/physical|physical]]"',
  "types:",
  '  - "[[recipes]]"',
  "---",
  "",
  "Rolled oats.",
  "",
].join("\n");

describe("referenceOf", () => {
  it("reads the name, the body and the words the picker shows", () => {
    const note = referenceOf("oatmeal.md", "memory://vault/References/oatmeal.md", OATMEAL);

    expect(note.name).toBe("oatmeal");
    expect(note.body).toBe("\nRolled oats.\n");
    expect(note.ingredients).toEqual(["oats", "milk"]);
    expect(note.categories).toEqual(["physical"]);
    expect(note.types).toEqual(["recipes"]);
  });

  it("reads a note with no frontmatter as bare words", () => {
    const note = referenceOf("Notes.md", "memory://vault/References/Notes.md", "Text.");

    expect(note.name).toBe("Notes");
    expect(note.ingredients).toEqual([]);
    expect(note.body).toBe("Text.");
  });
});

describe("loadReferences", () => {
  it("lists the folder's notes by name and leaves other folders out", async () => {
    const vault = createMemoryVault({
      "References/oatmeal.md": OATMEAL,
      "References/Circe.md": "A book.",
      "Tasks/Call Mum.md": '---\nkind: "[[tasks]]"\n---\n',
    });

    const notes = await loadReferences(vault, MEMORY_ROOT);

    expect(notes.map((note) => note.name)).toEqual(["Circe", "oatmeal"]);
  });

  it("holds an empty list when the folder is missing or no root is granted", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": "---\n---\n" });

    expect(await loadReferences(vault, MEMORY_ROOT)).toEqual([]);
    expect(await loadReferences(vault, null)).toEqual([]);
  });

  it("drops a note the adapter cannot read", async () => {
    const vault = createMemoryVault({
      "References/oatmeal.md": OATMEAL,
      "References/broken.md": "Text.",
    });
    vault.hooks.failNext("read", "broken.md");

    const notes = await loadReferences(vault, MEMORY_ROOT);

    expect(notes.map((note) => note.name)).toEqual(["oatmeal"]);
  });
});
