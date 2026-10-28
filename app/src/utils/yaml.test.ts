import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { parseFrontmatter } from "@monkey-tasks/schemas";
import { serializeValue } from "./yaml";

/** Titles a user can type or paste, each one a trap for some emitter. */
const TRICKY = [
  '"Dune" by Herbert',
  "#1 \\ backlog",
  "C:\\Users\\me",
  "Pay bill: water",
  "ends with a colon:",
  "a colon:\tthen a tab",
  "It's done",
  "'single'",
  '"',
  "\\",
  "a # b",
  "- starts with a dash",
  "[[Focus]]",
  "{curly}",
  "& * ! | > % @ `",
  "true",
  "No",
  "~",
  "123",
  "1e3",
  "",
  " padded ",
  "line\nbreak",
  "tab\tinside",
  "emoji \u{1F600} and \u00e9",
  "line\u2028separator",
  "\u00a0no-break space",
  "bell \x07 and escape \x1b",
  "nul \0 inside",
  "delete \x7f and next line \x85",
  "\ufeffbyte order mark",
];

/** The frontmatter block both parsers read. */
function block(value: string): string {
  return `title: ${serializeValue(value)}\nlists:\n${serializeValue([value])}`;
}

describe("serializeValue round trip (ticket 0053)", () => {
  it.each(TRICKY.map((value) => [JSON.stringify(value), value]))(
    "the app reads back %s",
    (_label, value) => {
      const values = parseFrontmatter("x.md", `---\n${block(value)}\n---\n`)
        .values;
      expect(values.title).toBe(value);
      expect(values.lists).toEqual([value]);
    },
  );

  it.each(TRICKY.map((value) => [JSON.stringify(value), value]))(
    "js-yaml reads back %s",
    (_label, value) => {
      expect(load(block(value))).toEqual({ title: value, lists: [value] });
    },
  );
});
