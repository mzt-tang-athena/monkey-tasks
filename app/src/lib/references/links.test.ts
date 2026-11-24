import { describe, expect, it } from "vitest";
import {
  attachReference,
  bodyWithoutReferences,
  detachReference,
  linkTarget,
  linkWords,
  parseReferences,
} from "./links";

const NOTES = [
  "## Notes",
  "",
  "Keep the receipt.",
  "",
].join("\n");

describe("parseReferences", () => {
  it("reads the links under the heading, once each, in order", () => {
    const body = [
      "",
      "## Reference",
      "",
      "[[oatmeal]]",
      "[[miso-soup]]",
      "[[oatmeal]]",
      "",
    ].join("\n");

    expect(parseReferences(body)).toEqual(["oatmeal", "miso-soup"]);
  });

  it("reads a low-case heading and stops at the next section", () => {
    const body = ["## reference", "[[oatmeal]]", "## Notes", "[[not-a-link]]"].join(
      "\n",
    );

    expect(parseReferences(body)).toEqual(["oatmeal"]);
  });

  it("ignores a link outside the section and a note with no section", () => {
    expect(parseReferences("Ate [[oatmeal]] today.")).toEqual([]);
    expect(
      parseReferences(["## Notes", "", "Ate [[oatmeal]]."].join("\n")),
    ).toEqual([]);
  });

  it("reads the note behind a folder path or an alias", () => {
    const body = ["## Reference", "[[References/oatmeal|Oats]]"].join("\n");

    expect(parseReferences(body)).toEqual(["oatmeal"]);
  });
});

describe("bodyWithoutReferences", () => {
  it("takes the heading and its links out and keeps the rest", () => {
    const body = "Notes first.\n\n## Reference\n\n[[oatmeal]]\n";

    expect(bodyWithoutReferences(body)).toBe("Notes first.\n");
  });

  it("keeps a body with no section as it is", () => {
    expect(bodyWithoutReferences(NOTES)).toBe(NOTES);
  });
});

describe("linkTarget and linkWords", () => {
  it("names the note a link points at", () => {
    expect(linkTarget("[[oatmeal]]")).toBe("oatmeal");
    expect(linkTarget("[[References/oatmeal|Oats]]")).toBe("oatmeal");
    expect(linkTarget("[[japanese curry batch]]")).toBe("japanese curry batch");
  });

  it("shows an alias when a frontmatter link has one", () => {
    expect(linkWords("[[Waypoints/physical|physical]]")).toBe("physical");
    expect(linkWords("[[recipes]]")).toBe("recipes");
    expect(linkWords("books")).toBe("books");
    expect(linkWords("")).toBe("");
  });
});

describe("attachReference", () => {
  it("writes the heading and the link into an empty body", () => {
    expect(attachReference("", "oatmeal")).toBe("## Reference\n\n[[oatmeal]]\n");
  });

  it("keeps the rest of a body unchanged", () => {
    const body = NOTES;

    expect(attachReference(body, "oatmeal")).toBe(
      `${body}\n## Reference\n\n[[oatmeal]]\n`,
    );
  });

  it("adds a second link as its own line", () => {
    const once = attachReference("", "oatmeal");

    expect(attachReference(once, "miso-soup")).toBe(
      "## Reference\n\n[[oatmeal]]\n[[miso-soup]]\n",
    );
  });

  it("adds no duplicate", () => {
    const once = attachReference("", "oatmeal");

    expect(attachReference(once, "oatmeal")).toBe(once);
  });

  it("keeps the note's own line endings", () => {
    const body = "## Notes\r\n\r\nKeep it.\r\n";

    expect(attachReference(body, "oatmeal")).toBe(
      `${body}\r\n## Reference\r\n\r\n[[oatmeal]]\r\n`,
    );
  });
});

describe("detachReference", () => {
  it("removes one link and keeps the other", () => {
    const body = "## Reference\n\n[[oatmeal]]\n[[miso-soup]]\n";

    expect(detachReference(body, "oatmeal")).toBe(
      "## Reference\n\n[[miso-soup]]\n",
    );
  });

  it("removes the heading and its blank line with the last link", () => {
    const body = `${NOTES}\n## Reference\n\n[[oatmeal]]\n`;

    expect(detachReference(body, "oatmeal")).toBe(NOTES);
  });

  it("puts an empty body back to empty", () => {
    expect(detachReference(attachReference("", "oatmeal"), "oatmeal")).toBe("");
  });

  it("leaves a body with no section alone", () => {
    expect(detachReference(NOTES, "oatmeal")).toBe(NOTES);
  });

  it("leaves the heading while other text stays under it", () => {
    const body = "## Reference\n\n[[oatmeal]]\nOnly this note.\n";

    expect(detachReference(body, "oatmeal")).toBe(
      "## Reference\n\nOnly this note.\n",
    );
  });
});
