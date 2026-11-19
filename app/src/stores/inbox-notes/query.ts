import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { InboxRead } from "@/lib/inbox-notes/read-inbox";
import { loadInbox } from "@/lib/inbox-notes/read-inbox";
import { sortInboxNotes, type InboxNote } from "@/lib/inbox-notes/model";
import type { VaultAdapter } from "@/lib/vault/adapter";
import { vaultIdle } from "@/lib/vault/read-gate";

/**
 * The Inbox notes' read. The cache holds the modeled cards, sorted. The
 * policy is the task and journal stores': one read on mount, one on a
 * grant, one on the pane's Reload vault, one on the return to the
 * foreground, and never behind a write.
 */

/** The first part of every inbox key. */
export const INBOX_KEY = "inbox-notes";

/** The cache entry for one granted root. */
export function inboxKey(root: string | null): readonly [string, string | null] {
  return [INBOX_KEY, root];
}

/** What the cache holds now, or undefined before the first read. */
export function cachedInbox(
  client: QueryClient,
  root: string | null,
): InboxRead | undefined {
  return client.getQueryData<InboxRead>(inboxKey(root));
}

/** The read of one granted root. With no root there is nothing to read. */
export function inboxQueryOptions(
  adapter: VaultAdapter,
  root: string | null,
  client: QueryClient,
) {
  return queryOptions({
    queryKey: inboxKey(root),
    queryFn: async ({ signal }): Promise<InboxRead> => {
      await vaultIdle(client, signal);
      return loadInbox(adapter, root as string);
    },
    enabled: root != null,
    networkMode: "always",
    // A cache entry never goes stale on its own, so focus must ask for
    // the read (the same reason the task query sets it).
    refetchOnWindowFocus: "always",
  });
}

/**
 * The cache with one note added or replaced, in order. The folder and
 * the unreadable list stay from the read that is already there.
 */
export function withNote(
  old: InboxRead | undefined,
  note: InboxNote,
  folder: string | null,
): InboxRead {
  const others = (old?.notes ?? []).filter(
    (candidate) => candidate.uri !== note.uri,
  );
  return {
    folder: old?.folder ?? folder,
    notes: sortInboxNotes([note, ...others]),
    unreadable: old?.unreadable ?? [],
  };
}
