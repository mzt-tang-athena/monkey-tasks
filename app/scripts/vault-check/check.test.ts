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
        '---\nkind: "[[deeds]]"\ncreated: 2026-10-25\n---\n\nBody.\n',
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
