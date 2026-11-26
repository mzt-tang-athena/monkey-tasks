import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkVault } from "./check.js";

const dirs: string[] = [];

/** Write a vault from `{ "Tasks/Shop.md": "..." }` and return its root. */
function vault(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "vault-check-"));
  dirs.push(dir);
  for (const [path, text] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const task = (extra = "") =>
  `---\nkind: "[[tasks]]"\ncreated: 2026-10-25\n${extra}---\n\nBody.\n`;

describe("checkVault", () => {
  it("reports nothing for a clean vault", () => {
    const dir = vault({
      "Tasks/Shop.md": task(),
      "Tasks/Lists/Focus.md":
        '---\nkind: "[[lists]]"\ncreated: 2026-10-25\n---\n\n# Focus\n',
      "Deeds/Garden.md":
        '---\nkind: "[[deeds]]"\nstatus: "[[active]]"\n---\n\n# Garden\n',
      "Journal/Daily/2026-10-25.md": "Just a body, no frontmatter.\n",
    });

    expect(checkVault(dir)).toEqual({ notes: 4, findings: [] });
  });

  it("reports a note that fails validation", () => {
    const dir = vault({
      "Tasks/Bad.md":
        '---\nkind: "[[lists]]"\ncreated: 2026-10-25\n---\n\nBody.\n',
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Tasks/Bad.md",
      line: 2,
      kind: "invalid",
    });
    expect(findings[0].reason).toContain("kind:");
  });

  it("reports a bare wikilink and does not repeat it as a parser finding", () => {
    const dir = vault({
      "Tasks/Shop.md": task("lists:\n  - [[Focus]]\n"),
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Tasks/Shop.md",
      line: 5,
      kind: "bare-wikilink",
    });
    expect(findings[0].reason).toContain("[[Focus]]");
  });

  it.each([
    ["no indent", ""],
    ["two spaces", "  "],
    ["four spaces", "    "],
  ])("reads list items at %s the way js-yaml does", (_label, indent) => {
    const dir = vault({
      "Tasks/Shop.md": task(`lists:\n${indent}- "[[Focus]]"\n`),
    });

    expect(checkVault(dir)).toEqual({ notes: 1, findings: [] });
  });

  // YAML forbids a tab in indentation. The app reads the list, so the
  // task stays on its list page, but Obsidian cannot read the note.
  it("reports a tab-indented list as YAML js-yaml cannot parse", () => {
    const dir = vault({
      "Tasks/Shop.md": task('lists:\n\t- "[[Focus]]"\n'),
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    // The finding points at the tab, so the user knows which line to fix.
    expect(findings[0]).toMatchObject({
      line: 5,
      kind: "parser-disagreement",
      reason:
        "js-yaml cannot parse the frontmatter: tab characters must not be used in indentation",
    });
  });

  it.each([
    ["no indent", ""],
    ["four spaces", "    "],
  ])("reports a bare wikilink at %s once", (_label, indent) => {
    const dir = vault({
      "Tasks/Shop.md": task(`lists:\n${indent}- [[Focus]]\n`),
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ line: 5, kind: "bare-wikilink" });
  });

  it("reads back a title the app quoted with escapes", () => {
    const dir = vault({
      "Tasks/Dune.md": task('title: "\\"Dune\\" by Herbert \\\\ 1"\n'),
    });

    expect(checkVault(dir)).toEqual({ notes: 1, findings: [] });
  });

  it("reads a numeric order the same as the app's text form", () => {
    const dir = vault({
      "Tasks/Ordered.md": task("order: 3\n"),
    });

    expect(checkVault(dir)).toEqual({ notes: 1, findings: [] });
  });

  it("reports a value the two parsers read differently", () => {
    const dir = vault({
      "Tasks/Old.md": task("lists:\n  - - Focus\n"),
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Tasks/Old.md",
      line: 4,
      kind: "parser-disagreement",
    });
    expect(findings[0].reason).toContain('the app reads ["- Focus"]');
    expect(findings[0].reason).toContain('js-yaml reads [["Focus"]]');
  });

  it("reports frontmatter js-yaml cannot parse", () => {
    const dir = vault({
      "Tasks/Broken.md": task("title: [unclosed\n"),
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("parser-disagreement");
    expect(findings[0].reason).toContain("js-yaml cannot parse");
  });

  it("checks wikilinks in every note but leaves other folders to Obsidian", () => {
    const dir = vault({
      "Journal/2026-10-25.md":
        '---\nbanner_position: 20\nlink: [[Focus]]\n---\n\nBody.\n',
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Journal/2026-10-25.md",
      line: 3,
      kind: "bare-wikilink",
    });
  });

  it("skips hidden folders", () => {
    const dir = vault({
      ".obsidian/workspace.md": task("lists:\n  - [[Focus]]\n"),
    });

    expect(checkVault(dir)).toEqual({ notes: 0, findings: [] });
  });
});

describe("the one list field", () => {
  it("accepts one list link", () => {
    const dir = vault({ "Tasks/Shop.md": task('list: "[[Focus]]"\n') });

    expect(checkVault(dir)).toEqual({ notes: 1, findings: [] });
  });

  it("accepts the field written empty", () => {
    const dir = vault({ "Tasks/Shop.md": task("list:\n") });

    expect(checkVault(dir)).toEqual({ notes: 1, findings: [] });
  });

  it("accepts a legacy two-link lists field", () => {
    const dir = vault({
      "Tasks/Shop.md": task('lists:\n  - "[[Focus]]"\n  - "[[Home]]"\n'),
    });

    expect(checkVault(dir)).toEqual({ notes: 1, findings: [] });
  });

  it("reports an empty string as a list value", () => {
    const dir = vault({ "Tasks/Shop.md": task('list: ""\n') });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Tasks/Shop.md",
      line: 4,
      kind: "invalid",
    });
    expect(findings[0].reason).toContain("list:");
  });

  it("reports a block under list", () => {
    const dir = vault({ "Tasks/Shop.md": task('list:\n  - "[[Focus]]"\n') });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Tasks/Shop.md",
      line: 4,
      kind: "invalid",
    });
    expect(findings[0].reason).toContain("list:");
  });

  it("reports an unreadable alert weight as a warning", () => {
    const dir = vault({ "Tasks/Shop.md": task("alert weight: loud\n") });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Tasks/Shop.md",
      line: 4,
      kind: "warning",
    });
    expect(findings[0].reason).toBe(
      'alert weight "loud" is not harsh or quiet, so it is a normal reminder',
    );
  });

  it("accepts a harsh or quiet alert weight", () => {
    const dir = vault({
      "Tasks/Shop.md": task("alert weight: harsh\n"),
      "Tasks/Call.md": task("alert weight: quiet\n"),
    });

    expect(checkVault(dir)).toEqual({ notes: 2, findings: [] });
  });
});

describe("deed notes", () => {
  it("reads a deed with the task schema, created date or not", () => {
    const dir = vault({
      "Deeds/Garden.md":
        '---\nkind: deeds\nstatus: "[[active]]"\nparent deed: "[[Home]]"\nafter: "[[Order]]"\n---\n\n# Garden\n',
      "Deeds/Ideas.md":
        '---\nkind: "[[deeds]]"\nparent deed: "[[Home]]"\n---\n\nSomeday.\n',
    });

    expect(checkVault(dir)).toEqual({ notes: 2, findings: [] });
  });

  it("warns on status done with no completed, at the status line", () => {
    const dir = vault({
      "Deeds/Garden.md": '---\nkind: "[[deeds]]"\nstatus: "[[done]]"\n---\n',
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Deeds/Garden.md",
      line: 3,
      kind: "warning",
      reason: "status [[done]] has no completed date",
    });
  });

  it("warns on a completed date that is not done, at its own line", () => {
    const dir = vault({
      "Deeds/Garden.md":
        '---\nkind: "[[deeds]]"\nstatus: "[[active]]"\ncompleted: 2026-10-25\n---\n',
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Deeds/Garden.md",
      line: 4,
      kind: "warning",
    });
    expect(findings[0].reason).toBe(
      "completed date with status [[active]] is not done",
    );
  });

  it("reports a status outside the five values as invalid", () => {
    const dir = vault({
      "Deeds/Garden.md": '---\nkind: "[[deeds]]"\nstatus: "[[growing]]"\n---\n',
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Deeds/Garden.md",
      line: 3,
      kind: "invalid",
    });
    expect(findings[0].reason).toContain("status:");
  });

  it("warns on an unreadable alert weight at its own line", () => {
    const dir = vault({
      "Deeds/Garden.md":
        '---\nkind: "[[deeds]]"\nstatus: "[[backlog]]"\nalert weight: loud\n---\n',
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Deeds/Garden.md",
      line: 4,
      kind: "warning",
    });
    expect(findings[0].reason).toContain("alert weight");
  });

  it("names a blocked by link that reaches no note", () => {
    const dir = vault({
      "Deeds/Garden.md":
        '---\nkind: "[[deeds]]"\nstatus: "[[active]]"\nblocked by:\n  - "[[Gone note]]"\n---\n',
    });

    const { findings } = checkVault(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "Deeds/Garden.md",
      line: 4,
      kind: "warning",
      reason: "blocked by [[Gone note]] reaches no note",
    });
  });

  it("accepts a blocked by link that reaches a note, done or not", () => {
    const dir = vault({
      "Deeds/Garden.md":
        '---\nkind: "[[deeds]]"\nstatus: "[[active]]"\nblocked by:\n  - "[[Order things]]"\n---\n',
      "Tasks/Order things.md": task(),
    });

    expect(checkVault(dir)).toEqual({ notes: 2, findings: [] });
  });
});
