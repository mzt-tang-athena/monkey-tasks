import type { VaultAdapter } from "./adapter";
import { NoteChangedError, createNote } from "./notes";

/**
 * Android SAF has no rename call, and expo-file-system cannot move a
 * content:// document. A rename is therefore a create in the same
 * folder followed by a delete of the old file. Obsidian sees a create
 * and a delete, not a rename, so links to the old name do not follow.
 *
 * If any step fails the new file is removed again, so the caller keeps
 * the old note rather than a half-written copy of it.
 */
export async function renameNote(
  adapter: VaultAdapter,
  oldUri: string,
  fileName: string,
  text: string,
  expected: string,
  title: string,
): Promise<{ uri: string; fileName: string; text: string }> {
  // A rename deletes the old note, so it must not race another writer:
  // the delete would take their change with it.
  if ((await adapter.read(oldUri)) !== expected) {
    throw new NoteChangedError(oldUri);
  }
  // The file name may not hold the typed name: the app cleaned it, or
  // the provider appended " (1)". The note then carries the typed name
  // as its title, so the row keeps it.
  const created = await createNote(
    adapter,
    adapter.parentOf(oldUri),
    fileName,
    text,
    title,
  );
  try {
    await adapter.remove(oldUri);
  } catch (error) {
    await adapter.remove(created.uri).catch(() => undefined);
    throw error;
  }
  return created;
}
