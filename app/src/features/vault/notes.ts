import * as FileSystem from "expo-file-system/legacy";
import { displayName } from "./scan";

const { StorageAccessFramework } = FileSystem;

export async function readNote(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function writeNote(uri: string, content: string): Promise<void> {
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

/** Another writer changed the file between the read and the write. */
export class NoteChangedError extends Error {
  readonly uri: string;

  constructor(uri: string) {
    super("the note changed on disk");
    this.name = "NoteChangedError";
    this.uri = uri;
  }
}

/** The file could not be read back, so the write cannot be checked. */
export class NoteUnreadableError extends Error {
  readonly uri: string;
  readonly reason: unknown;

  constructor(uri: string, reason: unknown) {
    super("the note could not be read");
    this.name = "NoteUnreadableError";
    this.uri = uri;
    this.reason = reason;
  }
}

/**
 * Write only when the file still holds the text the caller started
 * from. Every write is a read-modify-write cycle, and another writer
 * (Obsidian, the sync client, another device) can land between the
 * two. A plain write would drop that change without a word.
 */
export async function writeNoteIfUnchanged(
  uri: string,
  expected: string,
  next: string,
): Promise<void> {
  let current: string;
  try {
    current = await readNote(uri);
  } catch (error) {
    throw new NoteUnreadableError(uri, error);
  }
  if (current !== expected) {
    throw new NoteChangedError(uri);
  }
  await writeNote(uri, next);
}

/** Delete a note file. A file already gone is not an error. */
export async function deleteNote(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

/**
 * Create a note file in a folder and write it. The document provider
 * appends " (1)" when the requested name is taken, so the result
 * carries the name the file really got. When that name differs and a
 * title is given, the title is written into the note: the display
 * prefers it, so the row keeps the name the user typed.
 */
export async function createNote(
  folderUri: string,
  fileName: string,
  content: string,
  title?: string,
): Promise<{ uri: string; fileName: string; text: string }> {
  const uri = await StorageAccessFramework.createFileAsync(
    folderUri,
    fileName,
    "text/markdown",
  );
  const actual = displayName(uri);
  const text =
    title != null && actual !== fileName
      ? updateProperty(content, "title", title)
      : content;
  await writeNote(uri, text);
  return { uri, fileName: actual, text };
}

type FrontmatterSpan = {
  body: string;
  start: number;
  end: number;
  /** Index right after the opening "---\n" line, where keys live. */
  insertAt: number;
};

function frontmatterSpan(text: string): FrontmatterSpan | null {
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
 * A value a YAML parser reads back as the same string. Free text can
 * carry a colon, a leading `#`, or read as a boolean or a number, and
 * an unquoted one would change meaning or break the note.
 */
function plainScalar(value: string): boolean {
  if (value === "" || value !== value.trim() || /[\n\r]/.test(value)) {
    return false;
  }
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(value)) {
    return false;
  }
  if (/: |:$|\s#/.test(value)) {
    return false;
  }
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(value)) {
    return false;
  }
  return !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(value);
}

/**
 * The one place a frontmatter value is laid out. A list is a block
 * under its key, because YAML reads an inline list of one item as a
 * string. A value that YAML would read as something else is quoted: a
 * wikilink reads as a nested list, a name with a colon breaks the
 * line, and `true` or `123` reads as a boolean or a number.
 */
export function serializeValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => `  - ${plainScalar(item) ? item : JSON.stringify(item)}`)
      .join("\n");
  }
  return plainScalar(value) ? value : JSON.stringify(value);
}

/**
 * Surgically edit one frontmatter property, preserving everything else
 * in the file byte for byte. `null` removes the property. List values
 * are written in the vault's block style.
 */
export function updateProperty(
  text: string,
  key: string,
  value: string | string[] | null,
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
  // items that follow it. Any indent counts, because Obsidian, other
  // editors, and older versions of this app have written two spaces,
  // four spaces, and tabs. Missing an item here would splice the next
  // key into the middle of the list.
  let endIndex = keyIndex + 1;
  while (endIndex < lines.length && /^[ \t]+- /.test(lines[endIndex])) {
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
