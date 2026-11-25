import { describe, expect, it } from "vitest";
import type { ReferenceNote } from "@/types/reference";
import { runsInOrder, searchReferences } from "./search";

function note(
  name: string,
  ingredients: string[] = [],
  categories: string[] = [],
  types: string[] = [],
): ReferenceNote {
  return {
    name,
    uri: `memory://vault/References/${name}.md`,
    text: "",
    body: "",
    ingredients,
    categories,
    types,
  };
}

const notes = [
  note("oatmeal", ["oats", "milk", "protein-powder"], ["physical"], ["recipes"]),
  note("chinese-steamed-eggs", ["eggs", "soy-sauce"], ["physical"], ["recipes"]),
  note("miso-soup", ["miso-paste", "water", "tofu"], ["physical"], ["recipes"]),
  note("Circe", [], ["environmental"], ["books"]),
];

describe("searchReferences", () => {
  it("finds a note by its name", () => {
    expect(searchReferences(notes, "egg").map((hit) => hit.name)).toEqual([
      "chinese-steamed-eggs",
    ]);
  });

  it("finds a note by an ingredient alone", () => {
    expect(searchReferences(notes, "oats").map((hit) => hit.name)).toEqual([
      "oatmeal",
    ]);
  });

  it("puts a name match before an ingredient match", () => {
    const both = [note("porridge", ["oats"]), note("oats", [])];

    expect(searchReferences(both, "oats").map((hit) => hit.name)).toEqual([
      "oats",
      "porridge",
    ]);
  });

  it("needs every word of a longer query", () => {
    expect(searchReferences(notes, "egg soy").map((hit) => hit.name)).toEqual([
      "chinese-steamed-eggs",
    ]);
    expect(searchReferences(notes, "egg tofu")).toEqual([]);
  });

  it("matches letters in order, so a short word finds a long name", () => {
    expect(searchReferences(notes, "cse").map((hit) => hit.name)).toContain(
      "chinese-steamed-eggs",
    );
  });

  it("answers an empty query with nothing", () => {
    expect(searchReferences(notes, "   ")).toEqual([]);
  });

  it("reads a run of letters in order", () => {
    expect(runsInOrder("chinese-steamed-eggs", "cse")).toBe(true);
    expect(runsInOrder("chinese-steamed-eggs", "esc")).toBe(false);
  });
});
