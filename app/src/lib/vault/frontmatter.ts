import { serializeValue } from "@/utils/yaml";

type FrontmatterSpan = {
  body: string;
  start: number;
  end: number;
  /** Index right after the opening "---\n" line, where keys live. */
  insertAt: number;
};

/** The frontmatter block that opens a note, or null when it has none. */
export function frontmatterSpan(text: string): FrontmatterSpan | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) {
    return null;
  }
  const insertAt = text.indexOf("\n", match.index) + 1;
  return {
    body: match[1],
    start: match.index,
    end: match.index + match[0].length,
    insertAt,
  };
}

/**
 * Surgically edit one frontmatter property, preserving everything else
 * in the file byte for byte. `null` removes the property. List values
 * are written in the vault's block style.
 */
export function updateProperty(
  text: string,
  key: string,
  value: string | string[] | number | null,
): string {
  const span = frontmatterSpan(text);
  if (!span) {
    throw new Error("note has no frontmatter block");
  }
  const lines = span.body.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    new RegExp(`^${key}\\s*:`, "i").test(line),
  );
  if (keyIndex === -1) {
    if (value === null) {
      return text;
    }
    const serialized = serializeValue(value);
    // An array always goes on its own lines. A one-item array used to
    // land inline ("reminders:   - 09:00"), which YAML reads as a
    // string, so the note failed validation and its row vanished.
    const insert = Array.isArray(value)
      ? value.length === 0
        ? [`${key}:`]
        : [`${key}:`, serializeValue(value)]
      : serialized === ""
        ? [`${key}:`]
        : [`${key}: ${serialized}`];
    lines.push(...insert);
    return replaceSpan(text, span, lines.join("\n"));
  }
  // Find the extent of the property: its line plus any block list
  // items that follow it. Any indent counts, none included, because
  // Obsidian, other editors, and older versions of this app have
  // written no indent, two spaces, four spaces, and tabs. Missing an
  // item here would leave it behind under the next key.
  let endIndex = keyIndex + 1;
  while (endIndex < lines.length && /^[ \t]*- /.test(lines[endIndex])) {
    endIndex += 1;
  }
  if (value === null) {
    lines.splice(keyIndex, endIndex - keyIndex);
  } else {
    // Arrays always render in the vault's block style under the key.
    const replacement = Array.isArray(value)
      ? value.length === 0
        ? [`${key}:`]
        : [`${key}:`, serializeValue(value)]
      : value === ""
        ? [`${key}:`]
        : [`${key}: ${serializeValue(value)}`];
    lines.splice(keyIndex, endIndex - keyIndex, ...replacement);
  }
  return replaceSpan(text, span, lines.join("\n"));
}

function replaceSpan(
  text: string,
  span: FrontmatterSpan,
  newBody: string,
): string {
  const before = text.slice(0, span.start);
  const after = text.slice(span.end);
  return `${before}---\n${newBody}\n---${after.startsWith("\n") ? "" : "\n"}${after}`;
}

/**
 * Write a list property in the vault's block style. `updateProperty`
 * inserts a one-item array on the key's line when the key is missing,
 * which parses as a scalar rather than a list, so the key is seeded
 * empty first and then filled.
 */
export function setBlockList(
  text: string,
  key: string,
  values: string[],
): string {
  if (values.length === 0) {
    return updateProperty(text, key, null);
  }
  return updateProperty(updateProperty(text, key, []), key, values);
}

/**
 * Replace everything below the frontmatter block. The fence keeps the
 * newline that separates it from the body, so a body starting with a
 * newline keeps its blank line.
 */
export function replaceBody(text: string, body: string): string {
  const span = frontmatterSpan(text);
  if (!span) {
    throw new Error("note has no frontmatter block");
  }
  const fence = text.slice(0, span.end);
  if (body === "" || fence.endsWith("\n")) {
    return `${fence}${body}`;
  }
  return `${fence}\n${body}`;
}
