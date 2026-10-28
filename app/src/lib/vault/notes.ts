import * as FileSystem from "expo-file-system/legacy";
import { updateProperty } from "./frontmatter";
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
 * Write `name` as the note's title when the file name does not hold
 * it (ADR 0028). A file name can differ from the typed name in two
 * ways: the app cleans characters a provider refuses, and the provider
 * appends " (1)" to a name that is taken. The display prefers the
 * title, so the row keeps the name the user typed after the next read.
 */
export function keepTypedName(
  text: string,
  fileName: string,
  name: string,
): string {
  return fileName.replace(/\.md$/, "") === name
    ? text
    : updateProperty(text, "title", name);
}

/**
 * Create a note file in a folder and write it. The document provider
 * appends " (1)" when the requested name is taken, so the result
 * carries the name the file really got. When a title is given and the
 * file name does not hold it, the title is written into the note.
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
  const text = title == null ? content : keepTypedName(content, actual, title);
  await writeNote(uri, text);
  return { uri, fileName: actual, text };
}
