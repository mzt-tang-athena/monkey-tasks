import type { VaultAdapter } from "@/lib/vault/adapter";
import { frontmatterSpan } from "@/lib/vault/frontmatter";

/** The folder a `[[name]]` in the journal points at. */
export const REFERENCES_DIR = "References";

/**
 * The body of `References/<name>.md` below its frontmatter, or null when
 * the folder or the note is missing. A name that differs only in case
 * still finds its note, as Obsidian's links do.
 */
export async function readReference(
  adapter: VaultAdapter,
  root: string,
  name: string,
): Promise<string | null> {
  const folder = await adapter.findFolder(root, REFERENCES_DIR);
  if (folder == null) {
    return null;
  }
  const wanted = `${name}.md`;
  const files = (await adapter.list(folder)).filter((entry) => !entry.isFolder);
  const file =
    files.find((entry) => entry.name === wanted) ??
    files.find((entry) => entry.name.toLowerCase() === wanted.toLowerCase());
  if (file == null) {
    return null;
  }
  const text = await adapter.read(file.uri);
  return text.slice(frontmatterSpan(text)?.end ?? 0);
}
