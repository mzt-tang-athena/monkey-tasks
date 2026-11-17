import type { VaultAdapter } from "@/lib/vault/adapter";
import { writeNoteIfUnchanged } from "@/lib/vault/notes";
import {
  INBOX_FOLDER,
  inboxFileName,
  sortInboxNotes,
  toInboxNote,
  type InboxNote,
  type NoteDraft,
} from "./model";

/** What one read of the Inbox folder gives the cards. */
export type InboxRead = {
  /** The folder, or null when the vault has none yet. */
  folder: string | null;
  notes: InboxNote[];
  /** Names the folder listed that the app could not read. */
  unreadable: string[];
};

/**
 * Read the top-level `.md` files of `Inbox/`. A read never creates the
 * folder. One unreadable file goes into `unreadable` and the rest still
 * load.
 */
export async function loadInbox(
  adapter: VaultAdapter,
  root: string,
): Promise<InboxRead> {
  const folder = await adapter.findFolder(root, INBOX_FOLDER);
  if (folder == null) {
    return { folder: null, notes: [], unreadable: [] };
  }
  const entries = await adapter.list(folder);
  const files = entries.filter(
    (entry) => !entry.isFolder && /\.md$/i.test(entry.name),
  );
  const settled = await Promise.allSettled(
    files.map(async (file) =>
      toInboxNote(
        { uri: file.uri, fileName: file.name },
        await adapter.read(file.uri),
      ),
    ),
  );
  const notes: InboxNote[] = [];
  const unreadable: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      notes.push(result.value);
    } else {
      unreadable.push(files[index].name);
    }
  });
  return { folder, notes: sortInboxNotes(notes), unreadable };
}

/** The Inbox folder, or a new one. A write calls this; a read does not. */
export function ensureInboxFolder(
  adapter: VaultAdapter,
  root: string,
): Promise<string> {
  return adapter
    .findFolder(root, INBOX_FOLDER)
    .then((folder) => folder ?? adapter.makeFolder(root, INBOX_FOLDER));
}

/**
 * Create one note. The name is the stamp, with a slug when a title was
 * typed. The provider owns a collision, and the returned name is the
 * truth. The body is written exactly as typed, with no frontmatter.
 */
export async function createInboxNote(
  adapter: VaultAdapter,
  root: string,
  draft: NoteDraft,
  at: Date = new Date(),
): Promise<{ folder: string; note: InboxNote }> {
  const folder = await ensureInboxFolder(adapter, root);
  const created = await adapter.create(
    folder,
    inboxFileName(at, draft.title),
    draft.body,
  );
  return {
    folder,
    note: toInboxNote(
      { uri: created.uri, fileName: created.fileName },
      draft.body,
    ),
  };
}

/**
 * Save an edited note. The head is the frontmatter the editor opened,
 * kept byte for byte. The write lands only when the file still holds
 * the text the editor saw.
 */
export async function saveInboxNote(
  adapter: VaultAdapter,
  input: {
    uri: string;
    head: string;
    body: string;
    expected: string;
  },
): Promise<string> {
  const next = `${input.head}${input.body}`;
  await writeNoteIfUnchanged(adapter, input.uri, input.expected, next);
  return next;
}
