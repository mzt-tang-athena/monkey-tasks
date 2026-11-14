import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVault } from "@/lib/vault/vault-provider";
import { journalKey, journalQueryOptions } from "./query";

/** The read's state, flattened for the screen. */
export type JournalRead = {
  status: "loading" | "ready" | "error";
  /** The note's text. Empty before the first read, and for a missing note. */
  text: string;
  /** Why the read failed, ready to show. Null otherwise. */
  error: string | null;
};

/**
 * Today's note. A missing note reads as an empty one: the page is empty
 * and the first send creates the file.
 */
export function useJournalNote(day: string): JournalRead {
  const client = useQueryClient();
  const { adapter, root, booted } = useVault();
  const query = useQuery(journalQueryOptions(adapter, root, day, client));

  let status: JournalRead["status"] = "ready";
  if (!booted) {
    status = "loading";
  } else if (root != null && query.isError) {
    status = "error";
  } else if (root != null && query.isPending) {
    status = "loading";
  }

  return {
    status,
    text: query.data ?? "",
    error: query.error == null ? null : `vault read: ${messageOf(query.error)}`,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Read the day again, as pull to refresh does. */
export function useRefreshJournal(day: string): () => Promise<void> {
  const client = useQueryClient();
  const { root } = useVault();
  return React.useCallback(async () => {
    if (root == null) {
      return;
    }
    await client.refetchQueries({ queryKey: journalKey(root, day), exact: true });
  }, [client, root, day]);
}

/**
 * Ask for a vault folder. A new folder moves the read to its own key. A
 * grant of the folder already in use keeps the key, so the read runs
 * again: the user picked it to get it back.
 */
export function useGrantFolder(day: string): () => Promise<void> {
  const client = useQueryClient();
  const { root, grant } = useVault();
  return React.useCallback(async () => {
    const uri = await grant();
    if (uri != null && uri === root) {
      await client.refetchQueries({ queryKey: journalKey(root, day), exact: true });
    }
  }, [client, root, day, grant]);
}
