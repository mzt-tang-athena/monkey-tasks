import { listFrontmatter, validateNote } from "@monkey-tasks/schemas";
import { findSubfolder, listDirectory } from "@/lib/vault/scan";
import { readNote } from "@/lib/vault/notes";
import { formatIssues } from "@/utils/schema-errors";
import type { BrokenList, ListItem } from "@/types/task";

/** What the Lists folder holds: the usable tabs and the notes to fix. */
export type ListRead = {
  lists: ListItem[];
  broken: BrokenList[];
};

/**
 * A note is a list when its frontmatter kind is the wikilink
 * [[lists]]. The tab's name is the file name, so a note renamed in the
 * vault renames the tab on the next read. A note that fails the
 * frontmatter returns no name and its issues, so the store can offer
 * it for repair instead of hiding it.
 */
export function parseListNote(
  fileName: string,
  text: string,
): { name: string | null; errors: string[] } {
  const result = validateNote(fileName, text, listFrontmatter);
  if (result.data == null) {
    return {
      name: null,
      errors: result.errors ? formatIssues(result.errors.issues) : [],
    };
  }
  return { name: fileName.replace(/\.md$/, ""), errors: [] };
}

/**
 * The list notes in the Tasks folder's Lists subfolder, sorted by
 * name. The folder is only read when it exists: a vault with no
 * Lists folder keeps the fixed Main tab. A note that fails
 * the list frontmatter is reported as broken, never dropped or
 * counted as a tab; an unreadable note is dropped like before.
 */
export async function loadLists(tasksDirUri: string): Promise<ListRead> {
  const folder = await findSubfolder(tasksDirUri, "Lists");
  if (!folder) {
    return { lists: [], broken: [] };
  }
  const entries = await listDirectory(folder);
  const files = entries.filter(
    (entry) => entry.isFile && entry.name.endsWith(".md"),
  );
  const settled = await Promise.allSettled(
    files.map(async (file): Promise<ListItem | BrokenList> => {
      const text = await readNote(file.uri);
      const { name, errors } = parseListNote(file.name, text);
      const title = file.name.replace(/\.md$/, "");
      return name == null
        ? { name: title, uri: file.uri, errors }
        : { name, uri: file.uri };
    }),
  );
  const read = settled.flatMap((outcome) =>
    outcome.status === "fulfilled" ? [outcome.value] : [],
  );
  const lists = read
    .filter((item): item is ListItem => !("errors" in item))
    .sort((a, b) => a.name.localeCompare(b.name));
  const broken = read
    .filter((item): item is BrokenList => "errors" in item)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { lists, broken };
}
