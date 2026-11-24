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

describe("a fenced code block", () => {
  const FENCED = [
    "Note before the code.",
    "",
    "```md",
    "## Reference",
    "[[inside-code]]",
    "```",
    "",
  ].join("\n");

  const FENCED_TILDE = ["~~~", "## Reference", "[[inside-code]]", "~~~", ""].join(
    "\n",
  );

  it("is not a reference section, with a backtick or a tilde fence", () => {
    expect(parseReferences(FENCED)).toEqual([]);
    expect(parseReferences(FENCED_TILDE)).toEqual([]);
  });

  it("leaves the fence byte for byte and appends the real section", () => {
    const attached = attachReference(FENCED, "oatmeal");

    expect(attached.startsWith(FENCED)).toBe(true);
    expect(attached).toBe(`${FENCED}\n## Reference\n\n[[oatmeal]]\n`);
    expect(detachReference(attached, "oatmeal")).toBe(FENCED);
  });

  it("edits a real section above the fence, and the fence stays", () => {
    const body = [
      "## Reference",
      "",
      "[[oatmeal]]",
      "",
      "## Code",
      "",
      "```md",
      "## Reference",
      "[[inside-code]]",
      "```",
      "",
    ].join("\n");

    const attached = attachReference(body, "miso-soup");
    expect(attached).toContain("[[oatmeal]]\n[[miso-soup]]");
    expect(attached.slice(attached.indexOf("## Code"))).toBe(
      body.slice(body.indexOf("## Code")),
    );

    const detached = detachReference(attached, "oatmeal");
    expect(detached).not.toContain("[[oatmeal]]");
    expect(detached).toContain("[[inside-code]]");
    expect(detached.slice(detached.indexOf("## Code"))).toBe(
      body.slice(body.indexOf("## Code")),
    );
  });

  it("edits a real section below the fence, and the fence stays", () => {
    const body = [
      "```md",
      "## Reference",
      "[[inside-code]]",
      "```",
      "",
      "## Reference",
      "",
      "[[oatmeal]]",
      "",
    ].join("\n");

    const attached = attachReference(body, "miso-soup");
    expect(attached.startsWith("```md\n## Reference\n[[inside-code]]\n```\n")).toBe(
      true,
    );
    expect(attached).toContain("[[oatmeal]]\n[[miso-soup]]");
    expect(detachReference(attached, "miso-soup")).toBe(body);
  });

  it("ignores a link inside a fence in the real section", () => {
    const body = [
      "## Reference",
      "",
      "[[oatmeal]]",
      "",
      "```",
      "[[inside-code]]",
      "```",
      "",
    ].join("\n");

    expect(parseReferences(body)).toEqual(["oatmeal"]);
    const detached = detachReference(body, "oatmeal");
    expect(detached).not.toContain("[[oatmeal]]");
    expect(detached).toContain("```\n[[inside-code]]\n```");
  });

  it("keeps a shorter run from closing a longer fence", () => {
    const body = [
      "````",
      "## Reference",
      "[[inside-code]]",
      "```",
      "[[still-code]]",
      "````",
      "",
    ].join("\n");

    expect(parseReferences(body)).toEqual([]);
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
