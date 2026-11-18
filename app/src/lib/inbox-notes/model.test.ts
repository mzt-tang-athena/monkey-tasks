import { describe, expect, it } from "vitest";
import {
  inboxFileName,
  noteTitle,
  previewOfBody,
  slugify,
  sortInboxNotes,
  sortKeyOf,
  splitNote,
  toInboxNote,
} from "./model";

const at = new Date(2026, 10, 4, 12, 10);

describe("noteTitle", () => {
  it("shows a bare stamp as a local date and time", () => {
    expect(noteTitle("202611171030")).toBe("17 Nov 2026, 10:30");
    expect(noteTitle("202611010005")).toBe("1 Nov 2026, 00:05");
  });

  it("keeps the provider's collision suffix", () => {
    expect(noteTitle("202611171030 (1)")).toBe("17 Nov 2026, 10:30 (1)");
  });

  it("shows every other name exactly as written", () => {
    expect(noteTitle("20260921-1854-thought-dump")).toBe(
      "20260921-1854-thought-dump",
    );
    expect(noteTitle("20260919-flight-email-tracker")).toBe(
      "20260919-flight-email-tracker",
    );
    expect(noteTitle("declarative-vault-port")).toBe("declarative-vault-port");
    expect(noteTitle("have an agent monitor, organise and automate my emails")).toBe(
      "have an agent monitor, organise and automate my emails",
    );
  });

  it("falls back to the stem for an impossible date", () => {
    expect(noteTitle("202613011200")).toBe("202613011200");
    expect(noteTitle("202604311200")).toBe("202604311200");
    expect(noteTitle("202602291200")).toBe("202602291200");
    expect(noteTitle("20261117103")).toBe("20261117103");
    expect(noteTitle("2026111710300")).toBe("2026111710300");
  });
});

describe("sortKeyOf", () => {
  it("reads the three stamped shapes", () => {
    expect(sortKeyOf("202611171030")).toBe(202611171030);
    expect(sortKeyOf("202611171030 (1)")).toBe(202611171030);
    expect(sortKeyOf("20260921-1854-thought-dump")).toBe(202609211854);
    expect(sortKeyOf("20260919-flight-email-tracker")).toBe(202609190000);
  });

  it("reads a plain or impossible name as undated", () => {
    expect(sortKeyOf("declarative-vault-port")).toBeNull();
    expect(sortKeyOf("202613011200")).toBeNull();
    expect(sortKeyOf("20261117103")).toBeNull();
  });
});

describe("sortInboxNotes", () => {
  const note = (fileName: string) =>
    toInboxNote({ uri: `/Inbox/${fileName}`, fileName }, "x");

  it("puts dated notes newest first, then undated notes by name", () => {
    const sorted = sortInboxNotes([
      note("declarative-vault-port.md"),
      note("20260919-flight-email-tracker.md"),
      note("have an agent monitor.md"),
      note("202611041210.md"),
      note("20260921-1854-thought-dump.md"),
    ]);
    expect(sorted.map((held) => held.fileName)).toEqual([
      "202611041210.md",
      "20260921-1854-thought-dump.md",
      "20260919-flight-email-tracker.md",
      "declarative-vault-port.md",
      "have an agent monitor.md",
    ]);
  });

  it("puts the second capture in a minute above its twin", () => {
    const sorted = sortInboxNotes([
      note("202611041210.md"),
      note("202611041210 (1).md"),
    ]);
    expect(sorted[0].fileName).toBe("202611041210 (1).md");
  });
});

describe("splitNote", () => {
  it("returns the whole text as the body when there is no frontmatter", () => {
    expect(splitNote("one\n\ntwo\n")).toEqual({
      head: "",
      body: "one\n\ntwo\n",
    });
  });

  it("keeps the head and body byte for byte", () => {
    for (const text of [
      "---\nkind: resource\n---\nbody\n",
      "---\r\nkind: resource\r\n---\r\nbody\r\n",
      "---\nkind: resource\n---\nbody",
    ]) {
      const parts = splitNote(text);
      expect(parts.head + parts.body).toBe(text);
      expect(parts.body.replace(/\r?\n$/, "")).toBe("body");
    }
  });

  it("treats an unclosed fence as body", () => {
    expect(splitNote("---\nkind: resource\nbody\n")).toEqual({
      head: "",
      body: "---\nkind: resource\nbody\n",
    });
  });
});

describe("previewOfBody", () => {
  it("skips the frontmatter and strips the marks", () => {
    const text = [
      "---",
      "kind: resource",
      "---",
      "",
      "## Heading",
      "- **bold** and *italic* and `code`",
      "> quote",
      "1. [label](https://example.com)",
      "- [ ] task",
      "[[target|alias]]",
      "![[embed]]",
      "snake_case",
    ].join("\n");
    expect(previewOfBody(splitNote(text).body)).toBe(
      [
        "Heading",
        "bold and italic and code",
        "quote",
        "label",
        "task",
        "alias",
        "snake_case",
      ].join("\n"),
    );
  });

  it("flattens an indented paste", () => {
    const text = " - ## Slide 1\n     - a point\n         - deeper";
    expect(previewOfBody(text)).toBe("Slide 1\na point\ndeeper");
  });

  it("caps the preview at eight lines and 240 characters", () => {
    const many = Array.from({ length: 20 }, (_, index) => `line ${index}`).join(
      "\n",
    );
    expect(previewOfBody(many).split("\n")).toHaveLength(8);
    const long = "word ".repeat(100);
    const preview = previewOfBody(long);
    expect(preview.length).toBeLessThanOrEqual(240);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("reads an empty or frontmatter-only note as empty", () => {
    expect(previewOfBody("")).toBe("");
    expect(
      previewOfBody(splitNote("---\nkind: resource\n---\n").body),
    ).toBe("");
  });
});

describe("inboxFileName", () => {
  it("uses the local stamp with no title", () => {
    expect(inboxFileName(at, "")).toBe("202611041210.md");
  });

  it("adds a kebab slug when a title is typed", () => {
    expect(inboxFileName(at, "Thought dump!")).toBe(
      "202611041210-thought-dump.md",
    );
  });

  it("drops a title that has no slug in it", () => {
    expect(inboxFileName(at, "日本語")).toBe("202611041210.md");
  });
});

describe("slugify", () => {
  it("folds accents, punctuation and spacing", () => {
    expect(slugify("Café")).toBe("cafe");
    expect(slugify("  spaced   out  ")).toBe("spaced-out");
    expect(slugify("Thought dump!")).toBe("thought-dump");
  });

  it("caps a long title on a word boundary", () => {
    const slug = slugify("one ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("toInboxNote", () => {
  it("builds one card from the name and the text", () => {
    const note = toInboxNote(
      { uri: "/Inbox/202611041210.md", fileName: "202611041210.md" },
      "---\nkind: resource\n---\nA thought\n",
    );
    expect(note).toEqual({
      uri: "/Inbox/202611041210.md",
      fileName: "202611041210.md",
      stem: "202611041210",
      title: "4 Nov 2026, 12:10",
      preview: "A thought",
      sortKey: 202611041210,
    });
  });
});
