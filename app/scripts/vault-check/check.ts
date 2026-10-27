/**
 * Check a vault folder the way the app reads it, and the way a YAML
 * parser reads it (ticket 0037).
 *
 * The app reads three folders: `Tasks/`, `Tasks/Lists/` and `Deeds/`.
 * Those notes get the schema check and the parser check. Every note
 * gets the wikilink check, because a bare link corrupts any note the
 * next Obsidian edit rewrites.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import * as yaml from "js-yaml";
import {
  deedFrontmatter,
  listFrontmatter,
  parseFrontmatter,
  taskFrontmatter,
  validateNote,
} from "@monkey-tasks/schemas";

export type FindingKind = "invalid" | "bare-wikilink" | "parser-disagreement";

export type Finding = {
  /** Path relative to the vault folder, with forward slashes. */
  file: string;
  /** 1-based line in the file. */
  line: number;
  kind: FindingKind;
  reason: string;
};

export type VaultCheck = {
  /** How many markdown notes were walked. */
  notes: number;
  findings: Finding[];
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const BARE_ITEM = /^\s*-\s+\[\[[^\]]+\]\]\s*$/;
const BARE_SCALAR = /^[^:#\s][^:]*:\s*\[\[[^\]]+\]\]\s*$/;

/**
 * The schema for a note, by its folder. `null` means the app does not
 * read this note; only the wikilink check applies to it.
 */
function schemaFor(file: string) {
  if (/^Tasks\/Lists\/[^/]+\.md$/.test(file)) return listFrontmatter;
  if (/^Tasks\/[^/]+\.md$/.test(file)) return taskFrontmatter;
  if (/^Deeds\/[^/]+\.md$/.test(file)) return deedFrontmatter;
  return null;
}

/** Every markdown file under `dir`, as paths relative to `dir`. */
function walk(dir: string, root = dir): string[] {
  const found: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full, root));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      found.push(relative(root, full).split(sep).join("/"));
    }
  }
  return found;
}

/** The frontmatter block without its `---` fences, or null. */
function frontmatterBlock(text: string): string | null {
  const match = FRONTMATTER.exec(text);
  return match == null ? null : match[1];
}

/** The line that holds `key`, or the first line of the block. */
function lineOfKey(block: string, key: string): number {
  const lines = block.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  return index === -1 ? 2 : index + 2;
}

/** A value as the file holds it, for a finding's reason. */
function render(value: unknown): string {
  if (value === undefined) return "nothing";
  return JSON.stringify(value);
}

/**
 * True when the app's value and the YAML value mean the same thing.
 * Scalar types stay strict: a bare `20` is a number to YAML and a
 * string to the app, and the note should say which it means.
 */
/** Keys the schema reads as numbers; the app's own parser sees text. */
const NUMERIC_KEYS = new Set(["order"]);

function sameValue(
  key: string,
  app: string | string[] | null,
  parsed: unknown,
): boolean {
  if (
    NUMERIC_KEYS.has(key) &&
    typeof app === "string" &&
    typeof parsed === "number"
  ) {
    return Number(app) === parsed;
  }
  if (app == null) return parsed == null;
  if (typeof app === "string") {
    return typeof parsed === "string" && parsed === app;
  }
  if (!Array.isArray(parsed) || parsed.length !== app.length) return false;
  return parsed.every(
    (item, index) => typeof item === "string" && item === app[index],
  );
}

function checkNote(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  const block = frontmatterBlock(text);
  if (block == null) return findings;

  // A bare link, on any note.
  const bareKeys = new Set<string>();
  block.split(/\r?\n/).forEach((line, index) => {
    if (!BARE_ITEM.test(line) && !BARE_SCALAR.test(line)) return;
    // An item belongs to the key above it, at any indent.
    const key = BARE_ITEM.test(line)
      ? previousKey(block, index)
      : line.slice(0, line.indexOf(":")).trim();
    if (key != null) bareKeys.add(key);
    findings.push({
      file,
      line: index + 2,
      kind: "bare-wikilink",
      reason: `${line.trim()} is unquoted; YAML reads it as a list`,
    });
  });

  const schema = schemaFor(file);
  if (schema == null) return findings;

  const note = parseFrontmatter(file.split("/").pop() ?? file, text);
  const checked = validateNote(file.split("/").pop() ?? file, text, schema);
  for (const issue of checked.errors?.issues ?? []) {
    const key = String(issue.path[0] ?? "");
    findings.push({
      file,
      line: key === "" ? 2 : lineOfKey(block, key),
      kind: "invalid",
      reason: `${key === "" ? "note" : key}: ${issue.message}`,
    });
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(block) ?? {};
  } catch (error) {
    findings.push({
      file,
      ...parseFailure(error),
      kind: "parser-disagreement",
    });
    return findings;
  }
  if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) {
    findings.push({
      file,
      line: 2,
      kind: "parser-disagreement",
      reason: "js-yaml does not read the frontmatter as a mapping",
    });
    return findings;
  }

  const values = parsed as Record<string, unknown>;
  const keys = new Set([...Object.keys(note.values), ...Object.keys(values)]);
  for (const key of keys) {
    // A bare link is already reported, and quoting it fixes both.
    if (bareKeys.has(key)) continue;
    const app = note.values[key] ?? null;
    const theirs = values[key];
    if (sameValue(key, app, theirs)) continue;
    findings.push({
      file,
      line: lineOfKey(block, key),
      kind: "parser-disagreement",
      reason: `${key}: the app reads ${render(app)}, js-yaml reads ${render(
        theirs,
      )}`,
    });
  }
  return findings;
}

/**
 * Where and why js-yaml stopped. Its mark counts lines from the start
 * of the block, so the file line is two more: one for the zero base
 * and one for the opening `---`.
 */
function parseFailure(error: unknown): { line: number; reason: string } {
  const prefix = "js-yaml cannot parse the frontmatter";
  if (error instanceof yaml.YAMLException) {
    return {
      line: error.mark == null ? 2 : error.mark.line + 2,
      reason: `${prefix}: ${error.reason}`,
    };
  }
  return { line: 2, reason: `${prefix}: ${String(error)}` };
}

/** The key a list item belongs to: the nearest `key:` line above it. */
function previousKey(block: string, index: number): string | null {
  const lines = block.split(/\r?\n/);
  for (let i = index - 1; i >= 0; i -= 1) {
    const pair = /^([^:\s][^:]*):/.exec(lines[i]);
    if (pair) return pair[1].trim();
  }
  return null;
}

/** Walk `vaultDir` and report every finding. */
export function checkVault(vaultDir: string): VaultCheck {
  const files = walk(vaultDir);
  const findings: Finding[] = [];
  for (const file of files) {
    findings.push(...checkNote(file, readFileSync(join(vaultDir, file), "utf8")));
  }
  return { notes: files.length, findings };
}
