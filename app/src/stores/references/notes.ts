import { parseFrontmatter } from "@monkey-tasks/schemas";
import { linkWords } from "@/lib/references/links";
import type { VaultAdapter } from "@/lib/vault/adapter";
import type { ReferenceNote } from "@/types/reference";

/** The folder under the granted root that holds the reference notes. */
export const REFERENCES_FOLDER = "References";

/** Frontmatter words, with a wikilink's alias in words. */
function words(value: string | string[] | null | undefined): string[] {
  if (value == null) {
    return [];
  }
  return (Array.isArray(value) ? value : [value])
    .map(linkWords)
    .filter((word) => word !== "");
}

/** One reference note, as the picker lists it and the preview shows it. */
export function referenceOf(
  fileName: string,
  uri: string,
  text: string,
): ReferenceNote {
  const note = parseFrontmatter(fileName, text);
  return {
    name: note.title,
    uri,
    text,
    body: note.body,
    ingredients: words(note.values.ingredients),
    categories: words(note.values.categories),
    types: words(note.values.types),
  };
}

/**
 * Every note in the References folder, sorted by name. A vault with no
 * folder holds no references, and a note the adapter cannot read is
 * dropped rather than failing the whole read (ticket 0091): the picker
 * is a convenience, not a gate on the task.
 */
export async function loadReferences(
  adapter: VaultAdapter,
  root: string | null,
): Promise<ReferenceNote[]> {
  if (root == null) {
    return [];
  }
  const folder = await adapter.findFolder(root, REFERENCES_FOLDER);
  if (folder == null) {
    return [];
  }
  const entries = await adapter.list(folder);
  const files = entries.filter(
    (entry) => !entry.isFolder && entry.name.endsWith(".md"),
  );
  const read = await Promise.allSettled(
    files.map(async (file) =>
      referenceOf(file.name, file.uri, await adapter.read(file.uri)),
    ),
  );
  return read
    .flatMap((outcome) => (outcome.status === "fulfilled" ? [outcome.value] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
}
