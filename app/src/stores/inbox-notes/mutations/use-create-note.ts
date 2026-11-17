import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InboxNote, NoteDraft } from "@/lib/inbox-notes/model";
import {
  createInboxNote,
  type InboxRead,
} from "@/lib/inbox-notes/read-inbox";
import { VAULT_SCOPE, deferRead, runDeferredReads } from "@/lib/vault/read-gate";
import { useVault } from "@/lib/vault/vault-provider";
import { inboxKey, withNote } from "../query";

/**
 * Create an Inbox note. The folder is made when it is missing, and the
 * provider owns a taken name. The new card lands in the cache before
 * the next folder read.
 */
export function useCreateNote(): (draft: NoteDraft) => Promise<InboxNote> {
  const client = useQueryClient();
  const { adapter, root } = useVault();
  const key = inboxKey(root);

  const { mutateAsync } = useMutation<
    { folder: string; note: InboxNote },
    Error,
    NoteDraft,
    void
  >({
    mutationKey: [VAULT_SCOPE, "inbox note"],
    scope: { id: VAULT_SCOPE },
    networkMode: "always",
    retry: 0,
    meta: { label: "inbox note", listed: false },
    onMutate: async () => {
      await deferRead(client, key);
    },
    mutationFn: async (draft) => {
      if (root == null) {
        throw new Error("connect a vault folder first");
      }
      return createInboxNote(adapter, root, draft);
    },
    onSuccess: (created) => {
      client.setQueryData<InboxRead>(key, (old) =>
        withNote(old, created.note, created.folder),
      );
      // A capture can land before the first read. The read that follows
      // fills in the cards the create did not see.
      void client.invalidateQueries({ queryKey: key, exact: true });
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: [VAULT_SCOPE] }) <= 1) {
        runDeferredReads(client);
      }
    },
  });

  return React.useCallback(
    async (draft: NoteDraft) => (await mutateAsync(draft)).note,
    [mutateAsync],
  );
}
