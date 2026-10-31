import type { VaultAdapter } from "./adapter";
import { updateProperty } from "./frontmatter";

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
  adapter: VaultAdapter,
  uri: string,
  expected: string,
  next: string,
): Promise<void> {
  let current: string;
  try {
    current = await adapter.read(uri);
  } catch (error) {
    throw new NoteUnreadableError(uri, error);
  }
  if (current !== expected) {
    throw new NoteChangedError(uri);
  }
  await adapter.write(uri, next);
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
 *
 * The text goes in with the create, built for the name asked for. Only
 * when the provider picked another name is the title written again. If
 * that write fails, the new file goes too, so the caller never keeps a
 * note it was told failed.
 */
export async function createNote(
  adapter: VaultAdapter,
  folderUri: string,
  fileName: string,
  content: string,
  title?: string,
): Promise<{ uri: string; fileName: string; text: string }> {
  const asked =
    title == null ? content : keepTypedName(content, fileName, title);
  const created = await adapter.create(folderUri, fileName, asked);
  const text =
    title == null ? content : keepTypedName(content, created.fileName, title);
  if (text !== asked) {
    try {
      await adapter.write(created.uri, text);
    } catch (error) {
      await adapter.remove(created.uri).catch(() => undefined);
      throw error;
    }
  }
  return { ...created, text };
}
