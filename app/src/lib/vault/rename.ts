import * as FileSystem from "expo-file-system/legacy";
import { NoteChangedError, keepTypedName, readNote, writeNote } from "./notes";
import { displayName } from "./scan";

const { StorageAccessFramework } = FileSystem;

/**
 * Cut the last path segment of a SAF document uri. A child document is
 * addressed by its full path inside the encoded document id, so the
 * folder that holds it is the document id minus its last segment:
 * ".../document/primary%3ADocuments%2Fvault%2FTasks%2FCall.md" becomes
 * ".../document/primary%3ADocuments%2Fvault%2FTasks".
 *
 * The slashes inside the document id are percent-encoded, so the cut
 * happens on the decoded id and the result is encoded again; slicing
 * the uri itself would cut at "/document/" and hand the provider the
 * tree's document id instead of the folder's.
 */
export function parentUri(uri: string): string {
  const marker = "/document/";
  const at = uri.lastIndexOf(marker);
  if (at !== -1) {
    const head = uri.slice(0, at + marker.length);
    const documentId = decodeURIComponent(uri.slice(head.length));
    const cut = documentId.lastIndexOf("/");
    if (cut !== -1) {
      return `${head}${encodeURIComponent(documentId.slice(0, cut))}`;
    }
  }
  const cut = uri.lastIndexOf("/");
  return cut === -1 ? "" : uri.slice(0, cut);
}

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
  oldUri: string,
  fileName: string,
  text: string,
  expected: string,
  title: string,
): Promise<{ uri: string; text: string }> {
  let created: string | null = null;
  try {
    // A rename deletes the old note, so it must not race another
    // writer: the delete would take their change with it.
    if ((await readNote(oldUri)) !== expected) {
      throw new NoteChangedError(oldUri);
    }
    created = await StorageAccessFramework.createFileAsync(
      parentUri(oldUri),
      fileName,
      "text/markdown",
    );
    // The file name may not hold the typed name: the app cleaned it, or
    // the provider appended " (1)". The note then carries the typed
    // name as its title, so the row keeps it.
    const written = keepTypedName(text, displayName(created), title);
    await writeNote(created, written);
    await FileSystem.deleteAsync(oldUri, { idempotent: true });
    return { uri: created, text: written };
  } catch (error) {
    if (created != null) {
      await FileSystem.deleteAsync(created, { idempotent: true }).catch(
        () => undefined,
      );
    }
    throw error;
  }
}
