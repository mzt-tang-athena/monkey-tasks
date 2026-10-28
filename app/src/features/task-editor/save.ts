import { taskFrontmatter, validateNote } from "@monkey-tasks/schemas";
import * as FileSystem from "expo-file-system/legacy";
import { displayName } from "@/features/vault/scan";
import {
  NoteChangedError,
  keepTypedName,
  readNote,
  updateProperty,
  writeNote,
  writeNoteIfUnchanged,
} from "@/features/vault/notes";
import { safeFileName } from "@/features/capture/write";
import type { TaskEdit, TaskItem } from "@/types/task";

const { StorageAccessFramework } = FileSystem;

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

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
 * Replace everything below the frontmatter block. The fence keeps the
 * newline that separates it from the body, so a body starting with a
 * newline keeps its blank line.
 */
function replaceBody(text: string, body: string): string {
  const match = FRONTMATTER.exec(text);
  if (!match) {
    throw new Error("note has no frontmatter block");
  }
  const fence = match[0];
  if (body === "" || fence.endsWith("\n")) {
    return `${fence}${body}`;
  }
  return `${fence}\n${body}`;
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
async function renameNote(
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

/**
 * Write a list property in the vault's block style. `updateProperty`
 * inserts a one-item array on the key's line when the key is missing,
 * which parses as a scalar rather than a list, so the key is seeded
 * empty first and then filled.
 */
function setBlockList(text: string, key: string, values: string[]): string {
  if (values.length === 0) {
    return updateProperty(text, key, null);
  }
  return updateProperty(updateProperty(text, key, []), key, values);
}

/**
 * Write one editor submission to the note and return the row it
 * produces. Property edits are surgical, so unknown frontmatter
 * survives; only the body is replaced wholesale.
 */
export async function saveTaskEdit(
  item: TaskItem,
  edit: TaskEdit,
  expected: string = item.text,
): Promise<TaskItem> {
  // The draft was built from `expected`, so the property edits apply to
  // that text, not to whatever the store last read.
  let text = expected;
  text = updateProperty(text, "due", edit.due);
  text = updateProperty(text, "recurrence", edit.recurrence);
  text = setBlockList(text, "reminders", edit.reminders);
  text = setBlockList(
    text,
    "lists",
    edit.lists.map((name) => `[[${name}]]`),
  );
  text = replaceBody(text, edit.body);

  // A titled note uses its file name as an address, so a rename edits
  // the title instead of creating a new file. An untitled note keeps
  // the old behaviour, where the name is the file name.
  const titled = item.data?.title != null;
  const requestedName = `${safeFileName(edit.name)}.md`;
  const renaming = !titled && requestedName !== item.fileName;
  let uri = item.uri;
  let written: string;
  if (renaming) {
    const renamed = await renameNote(
      item.uri,
      requestedName,
      text,
      expected,
      edit.name,
    );
    uri = renamed.uri;
    written = renamed.text;
  } else {
    // An untitled note with no rename can still need a title: the
    // cleaned name matches the file, but the typed name does not, as
    // with "Pay bill: water" in "Pay bill water.md".
    written = titled
      ? updateProperty(text, "title", edit.name)
      : keepTypedName(text, item.fileName, edit.name);
    await writeNoteIfUnchanged(item.uri, expected, written);
  }

  // The provider may adjust the file name it was handed, so the row
  // reads the name the file really has.
  const fileName = renaming ? displayName(uri) : item.fileName;
  const note = validateNote(fileName, written, taskFrontmatter);
  return {
    // The row keeps its identity: a rename changes the uri, not which
    // row the list is showing.
    id: item.id,
    uri,
    fileName,
    name: edit.name,
    text: written,
    data: note.data,
    body: note.note.body,
  };
}
