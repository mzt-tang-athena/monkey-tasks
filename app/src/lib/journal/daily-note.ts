import type { VaultAdapter } from "@/lib/vault/adapter";
import { createNote, writeNoteIfUnchanged } from "@/lib/vault/notes";
import { planAppend } from "./format";

/**
 * Today's note on disk, the journal's only file I/O. The grammar lives
 * in `format.ts`.
 *
 * A read never creates. Only an append makes the folders and the note,
 * because creating on open races Obsidian's own daily-note creation
 * through sync.
 */

export const JOURNAL_DIR = "Journal";
export const DAILY_DIR = "Daily";

/** Where one day's note lives under the granted root. */
export function dailyPath(day: string): string {
  return `${JOURNAL_DIR}/${DAILY_DIR}/${day}.md`;
}

async function findNote(
  adapter: VaultAdapter,
  folder: string,
  fileName: string,
): Promise<string | null> {
  const entry = (await adapter.list(folder)).find(
    (candidate) => !candidate.isFolder && candidate.name === fileName,
  );
  return entry?.uri ?? null;
}

/** The note's whole text, or "" when the note or its folders are missing. */
export async function readDailyNote(
  adapter: VaultAdapter,
  root: string,
  day: string,
): Promise<string> {
  const journal = await adapter.findFolder(root, JOURNAL_DIR);
  const daily =
    journal == null ? null : await adapter.findFolder(journal, DAILY_DIR);
  const uri = daily == null ? null : await findNote(adapter, daily, `${day}.md`);
  return uri == null ? "" : adapter.read(uri);
}

/**
 * Append one block. The folders and the note are found or made, the
 * note is read whole, and the write lands only if the file still holds
 * the text it was read from (`NoteChangedError` otherwise).
 *
 * A retry is a fresh call, so it re-reads and never clobbers another
 * app's edit. Returns the note's text after the call and whether this
 * call wrote the block.
 */
export async function appendEntry(
  adapter: VaultAdapter,
  root: string,
  { day, block, retry = false }: { day: string; block: string; retry?: boolean },
): Promise<{ text: string; appended: boolean }> {
  const journal =
    (await adapter.findFolder(root, JOURNAL_DIR)) ??
    (await adapter.makeFolder(root, JOURNAL_DIR));
  const folder =
    (await adapter.findFolder(journal, DAILY_DIR)) ??
    (await adapter.makeFolder(journal, DAILY_DIR));
  const fileName = `${day}.md`;

  // The second pass runs only when another writer made the note between
  // the list and the create.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const uri = await findNote(adapter, folder, fileName);
    if (uri == null) {
      const created = await createNote(
        adapter,
        folder,
        fileName,
        planAppend("", block).text,
      );
      if (created.fileName === fileName) {
        return { text: created.text, appended: true };
      }
      // The provider renamed ours to "x (1).md", so the real note exists
      // now. Drop ours and append to the one that won.
      await adapter.remove(created.uri);
      continue;
    }
    const text = await adapter.read(uri);
    const plan = planAppend(text, block, { retry });
    if (plan.appended) {
      await writeNoteIfUnchanged(adapter, uri, text, plan.text);
    }
    return plan;
  }
  throw new Error(`${dailyPath(day)} could not be found or created`);
}
