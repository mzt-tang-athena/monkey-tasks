import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { readDailyNote } from "@/lib/journal/daily-note";
import type { VaultAdapter } from "@/lib/vault/adapter";
import { vaultIdle } from "@/lib/vault/read-gate";

/**
 * The journal's read. The cache holds one thing, the note's text, and
 * blocks, food lines and ids are derived from it on render, so there is
 * no second copy to keep in step.
 *
 * The policy is the task store's (ADR 0017), because the source is the
 * same vault: one read on mount, one on a grant, one on pull to
 * refresh, one on the return to the foreground, and never behind a
 * write.
 */

/** The first part of every journal key. */
export const JOURNAL_KEY = "journal";

/** The cache entry for one day of one granted root. */
export function journalKey(
  root: string | null,
  day: string,
): readonly [string, string | null, string] {
  return [JOURNAL_KEY, root, day];
}

/** The note's text in the cache now, or undefined before the first read. */
export function cachedNote(
  client: QueryClient,
  root: string | null,
  day: string,
): string | undefined {
  return client.getQueryData<string>(journalKey(root, day));
}

/** The read of one day. With no root there is nothing to read. */
export function journalQueryOptions(
  adapter: VaultAdapter,
  root: string | null,
  day: string,
  client: QueryClient,
) {
  return queryOptions({
    queryKey: journalKey(root, day),
    queryFn: async ({ signal }): Promise<string> => {
      await vaultIdle(client, signal);
      return readDailyNote(adapter, root as string, day);
    },
    enabled: root != null,
    networkMode: "always",
    // A cache entry never goes stale on its own, so focus must ask for
    // the read (the same reason the task query sets it).
    refetchOnWindowFocus: "always",
  });
}
