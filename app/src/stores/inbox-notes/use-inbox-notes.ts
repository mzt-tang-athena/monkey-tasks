import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { InboxNote } from "@/lib/inbox-notes/model";
import { useVault } from "@/lib/vault/vault-provider";
import { inboxKey, inboxQueryOptions } from "./query";

/** The read's state, flattened for the screen. */
export type InboxStatus = "loading" | "ready" | "error" | "novault";

export type InboxView = {
  status: InboxStatus;
  /** The notes, newest first. Empty until the first read lands. */
  notes: InboxNote[];
  /** Files the read could not open. */
  unreadable: string[];
  /** The Inbox folder, or null when the vault has none. */
  folder: string | null;
  /** Why the read failed, ready to show. */
  readError: string | null;
  rootUri: string | null;
  /** Read the folder again. True when the read landed. */
  refresh: () => Promise<boolean>;
  grant: () => Promise<void>;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The Inbox tab's read. A vault with no Inbox folder reads as no notes:
 * the first capture makes the folder.
 */
export function useInboxNotes(): InboxView {
  const client = useQueryClient();
  const { adapter, root, booted, grant: askForRoot } = useVault();
  const query = useQuery(inboxQueryOptions(adapter, root, client));

  const refresh = React.useCallback(async () => {
    if (root == null) {
      return false;
    }
    const result = await query.refetch();
    return result.isSuccess;
  }, [query, root]);

  const grant = React.useCallback(async () => {
    const uri = await askForRoot();
    if (uri != null && uri === root) {
      await client.refetchQueries({ queryKey: inboxKey(root), exact: true });
    }
  }, [askForRoot, client, root]);

  let status: InboxStatus = "ready";
  if (!booted) {
    status = "loading";
  } else if (root == null) {
    status = "novault";
  } else if (query.isError) {
    status = "error";
  } else if (query.data == null) {
    status = "loading";
  }

  return {
    status,
    notes: query.data?.notes ?? [],
    unreadable: query.data?.unreadable ?? [],
    folder: query.data?.folder ?? null,
    readError: query.error == null ? null : `vault read: ${messageOf(query.error)}`,
    rootUri: root,
    refresh,
    grant,
  };
}
