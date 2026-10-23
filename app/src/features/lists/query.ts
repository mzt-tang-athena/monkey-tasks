import { listFrontmatter, validateNote } from "@monkey-tasks/schemas";
import { findSubfolder, listDirectory } from "../vault/scan";
import { readNote } from "../vault/notes";

/** A list note, as the store exposes it: a tab name and its file. */
export type ListItem = {
  /** The note's file name without .md: the tab label. */
  name: string;
  uri: string;
};

/**
 * A note is a list when its frontmatter kind is the wikilink
 * [[lists]]. The tab's name is the file name, so a note renamed in the
 * vault renames the tab on the next read.
 */
export function parseListNote(fileName: string, text: string): string | null {
  const result = validateNote(fileName, text, listFrontmatter);
  if (result.data == null) {
    return null;
  }
  return fileName.replace(/\.md$/, "");
}

/**
 * The list notes in the Tasks folder's Lists subfolder, sorted by
 * name. The folder is only read when it exists: a vault with no
 * Lists folder keeps the fixed Focus and Main tabs. One unreadable
 * note is dropped, never the whole set.
 */
export async function loadLists(tasksDirUri: string): Promise<ListItem[]> {
  const folder = await findSubfolder(tasksDirUri, "Lists");
  if (!folder) {
    return [];
  }
  const entries = await listDirectory(folder);
  const files = entries.filter(
    (entry) => entry.isFile && entry.name.endsWith(".md"),
  );
  const settled = await Promise.allSettled(
    files.map(async (file): Promise<ListItem | null> => {
      const text = await readNote(file.uri);
      const name = parseListNote(file.name, text);
      return name == null ? null : { name, uri: file.uri };
    }),
  );
  return settled
    .flatMap((outcome) =>
      outcome.status === "fulfilled" && outcome.value ? [outcome.value] : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
