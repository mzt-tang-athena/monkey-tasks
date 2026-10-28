import { taskFrontmatter, validateNote } from "@monkey-tasks/schemas";
import { displayName } from "@/lib/vault/scan";
import { keepTypedName, writeNoteIfUnchanged } from "@/lib/vault/notes";
import {
  replaceBody,
  setBlockList,
  updateProperty,
} from "@/lib/vault/frontmatter";
import { renameNote } from "@/lib/vault/rename";
import { safeFileName } from "@/lib/vault/file-name";
import type { TaskEdit, TaskItem } from "@/types/task";

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
