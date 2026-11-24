/**
 * The reference section of a task body: a `## Reference` heading with
 * one wikilink per line. Obsidian renders the links, and the app reads
 * the same text (ticket 0091). The section is a body paragraph, not a
 * frontmatter property, so a note keeps one source for its links.
 */

/** The heading the links live under, as the app writes it. */
export const REFERENCE_HEADING = "Reference";

const LINK = /\[\[([^\]]+)\]\]/g;

/** A heading line at any level, so the section ends where the next one starts. */
function isHeading(line: string): boolean {
  return /^#{1,6}[ \t]/.test(line);
}

function headingWords(line: string): string {
  return line
    .replace(/^#{1,6}[ \t]+/, "")
    .replace(/[ \t]+$/, "")
    .toLowerCase();
}

/** The note a wikilink points at: no alias, anchor, folder or extension. */
export function linkTarget(link: string): string {
  const inner = link.replace(/^\[\[|\]\]$/g, "").trim();
  const target = inner.split("|")[0].split("#")[0].trim();
  return target
    .slice(target.lastIndexOf("/") + 1)
    .replace(/\.md$/i, "")
    .trim();
}

/**
 * The words a frontmatter link value shows: the alias when it has one,
 * so `[[Waypoints/physical|physical]]` reads "physical". A bare value
 * passes through, which keeps a hand-written note readable.
 */
export function linkWords(value: string): string {
  const inner = value.trim().replace(/^\[\[|\]\]$/g, "");
  const [target, alias] = inner.split("|");
  const shown = (alias ?? target).split("#")[0].trim();
  return shown
    .slice(shown.lastIndexOf("/") + 1)
    .replace(/\.md$/i, "")
    .trim();
}

/** A fenced code block's opening run: its character and its length. */
type Fence = { char: string; length: number };

function opensFence(line: string): Fence | null {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
  if (match == null) {
    return null;
  }
  const run = match[1];
  return { char: run[0], length: run.length };
}

function closesFence(line: string, fence: Fence): boolean {
  const run = /^ {0,3}(`+|~+)[ \t]*$/.exec(line)?.[1];
  return run != null && run[0] === fence.char && run.length >= fence.length;
}

/**
 * The lines a fenced code block holds, its fences included. A heading
 * or a wikilink inside a fence is code, not markdown, so the section
 * reader never counts one.
 */
function fencedLines(lines: string[]): boolean[] {
  const inside = lines.map(() => false);
  let open: Fence | null = null;
  for (let at = 0; at < lines.length; at += 1) {
    if (open == null) {
      const fence = opensFence(lines[at]);
      if (fence != null) {
        open = fence;
        inside[at] = true;
      }
      continue;
    }
    inside[at] = true;
    if (closesFence(lines[at], open)) {
      open = null;
    }
  }
  return inside;
}

/** The section's line span: the heading, the line after it, and the code. */
function sectionOf(
  lines: string[],
): { heading: number; end: number; code: boolean[] } | null {
  const code = fencedLines(lines);
  const heading = lines.findIndex(
    (line, at) => !code[at] && isHeading(line) && headingWords(line) === "reference",
  );
  if (heading === -1) {
    return null;
  }
  let end = heading + 1;
  while (end < lines.length && (code[end] || !isHeading(lines[end]))) {
    end += 1;
  }
  return { heading, end, code };
}

function newlineOf(body: string): string {
  return body.includes("\r\n") ? "\r\n" : "\n";
}

/** The link names a task body points at, in order, once each. */
export function parseReferences(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const section = sectionOf(lines);
  if (section == null) {
    return [];
  }
  const names: string[] = [];
  for (let at = section.heading + 1; at < section.end; at += 1) {
    if (section.code[at]) {
      continue;
    }
    for (const match of lines[at].matchAll(LINK)) {
      const name = linkTarget(match[0]);
      if (name !== "" && !names.includes(name)) {
        names.push(name);
      }
    }
  }
  return names;
}

/** The body as a note preview reads it: the reference section taken out. */
export function bodyWithoutReferences(body: string): string {
  const lines = body.split(/\r?\n/);
  const section = sectionOf(lines);
  if (section == null) {
    return body;
  }
  return [
    ...lines.slice(0, section.heading),
    ...lines.slice(section.end),
  ].join(newlineOf(body));
}

/** The line a new link joins: after the last link, or under the heading. */
function insertLink(
  lines: string[],
  section: { heading: number; end: number; code: boolean[] },
  link: string,
): string[] {
  const next = [...lines];
  let last = -1;
  for (let at = section.heading + 1; at < section.end; at += 1) {
    if (!section.code[at] && next[at].includes("[[")) {
      last = at;
    }
  }
  if (last !== -1) {
    next.splice(last + 1, 0, link);
    return next;
  }
  // A blank line keeps the heading and the links apart, as Obsidian
  // reads a list under a heading. A section with text but no link keeps
  // its text above the new link.
  if (next[section.heading + 1] == null) {
    next.push("", link);
  } else if (next[section.heading + 1] === "") {
    next.splice(section.heading + 2, 0, link);
  } else {
    next.splice(section.heading + 1, 0, "", link);
  }
  return next;
}

/**
 * Add one link to the task body. A link the body already holds changes
 * nothing, so attaching the same note twice adds one line.
 */
export function attachReference(body: string, name: string): string {
  const link = name.trim();
  if (link === "" || parseReferences(body).includes(link)) {
    return body;
  }
  const eol = newlineOf(body);
  const lines = body.split(/\r?\n/);
  const section = sectionOf(lines);
  if (section != null) {
    return insertLink(lines, section, `[[${link}]]`).join(eol);
  }
  const block = [`## ${REFERENCE_HEADING}`, "", `[[${link}]]`].join(eol);
  if (body === "") {
    return `${block}${eol}`;
  }
  if (body.endsWith(eol + eol)) {
    return `${body}${block}${eol}`;
  }
  if (body.endsWith(eol)) {
    return `${body}${eol}${block}${eol}`;
  }
  return `${body}${eol}${eol}${block}${eol}`;
}

/** One line with the links that point at `name` taken out. */
function withoutLinks(line: string, name: string): string {
  return line.replace(LINK, (token, inner: string) =>
    linkTarget(`[[${inner}]]`) === name ? "" : token,
  );
}

function trimTrailingBlanks(lines: string[]): string[] {
  const kept = [...lines];
  while (kept.length > 0 && kept[kept.length - 1].trim() === "") {
    kept.pop();
  }
  return kept;
}

/**
 * Remove one link from the task body. The heading and its blank line go
 * when no link and no other text stay under it; every other line keeps
 * its place, and a body with no section reads as it is. A link inside
 * a fence is code, so it stays.
 */
export function detachReference(body: string, name: string): string {
  const lines = body.split(/\r?\n/);
  const section = sectionOf(lines);
  if (section == null) {
    return body;
  }
  const eol = newlineOf(body);
  const kept: string[] = [];
  let changed = false;
  for (let at = section.heading + 1; at < section.end; at += 1) {
    const line = lines[at];
    if (section.code[at] || !line.includes("[[")) {
      kept.push(line);
      continue;
    }
    const next = withoutLinks(line, name);
    if (next === line) {
      kept.push(line);
      continue;
    }
    changed = true;
    if (next.trim() !== "") {
      kept.push(next);
    }
  }
  if (!changed) {
    return body;
  }
  const head = lines.slice(0, section.heading);
  const tail = lines.slice(section.end);
  if (kept.some((line) => line.includes("[[") || line.trim() !== "")) {
    return [...head, lines[section.heading], ...kept, ...tail].join(eol);
  }
  // Nothing is left under the heading, so the whole section goes.
  const atEnd = tail.every((line) => line.trim() === "");
  if (atEnd) {
    const before = trimTrailingBlanks(head);
    return [...before, ...(body.endsWith(eol) ? [""] : [])].join(eol);
  }
  return [...head, ...tail].join(eol);
}
