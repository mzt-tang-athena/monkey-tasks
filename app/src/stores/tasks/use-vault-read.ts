import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVault } from "@/lib/vault/vault-provider";
import { tasksKey } from "./query";

/**
 * Read the granted folder again, as pull to refresh does. The read
 * waits for the writes still pending. With no folder there is nothing
 * to read, so nothing runs.
 */
export function useRefreshTasks(): () => Promise<void> {
  const client = useQueryClient();
  const { root } = useVault();
  return React.useCallback(async () => {
    if (root == null) {
      return;
    }
    await client.refetchQueries({ queryKey: tasksKey(root), exact: true });
  }, [client, root]);
}

/**
 * Ask the user for a vault folder. A new folder moves the read to its
 * own key. A grant of the folder already in use keeps the key, so the
 * store reads it again: the user picked it to get it back.
 */
export function useGrantFolder(): () => Promise<void> {
  const client = useQueryClient();
  const { root, grant } = useVault();
  return React.useCallback(async () => {
    const uri = await grant();
    if (uri != null && uri === root) {
      await client.refetchQueries({ queryKey: tasksKey(root), exact: true });
    }
  }, [client, root, grant]);
}
