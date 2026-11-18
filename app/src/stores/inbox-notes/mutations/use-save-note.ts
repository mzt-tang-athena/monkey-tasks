import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toInboxNote } from "@/lib/inbox-notes/model";
import type { InboxRead } from "@/lib/inbox-notes/read-inbox";
import { saveInboxNote } from "@/lib/inbox-notes/read-inbox";
import { VAULT_SCOPE, deferRead, runDeferredReads } from "@/lib/vault/read-gate";
import { useVault } from "@/lib/vault/vault-provider";
import { inboxKey, withNote } from "../query";

export type SaveNoteInput = {
  uri: string;
  /** The name the vault holds, for the card after the save. */
  fileName: string;
  /** The frontmatter, byte for byte. */
  head: string;
  /** The body the editor holds. */
  body: string;
  /** The whole text the editor opened. The guard compares with it. */
  expected: string;
};

/**
 * Save an edited Inbox note through the read-check-write guard. A
 * refusal rejects with `NoteChangedError`; the editor keeps the draft
 * and offers its own way out.
 */
export function useSaveNote(): (input: SaveNoteInput) => Promise<void> {
  const client = useQueryClient();
  const { adapter, root } = useVault();
  const key = inboxKey(root);

  const { mutateAsync } = useMutation<string, Error, SaveNoteInput, void>({
    mutationKey: [VAULT_SCOPE, "inbox note save"],
    scope: { id: VAULT_SCOPE },
    networkMode: "always",
    retry: 0,
    meta: { label: "inbox note save", listed: false },
    onMutate: async () => {
      await deferRead(client, key);
    },
    mutationFn: (input) => saveInboxNote(adapter, input),
    onSuccess: (text, input) => {
      const note = toInboxNote(
        { uri: input.uri, fileName: input.fileName },
        text,
      );
      client.setQueryData<InboxRead>(key, (old) =>
        withNote(old, note, old?.folder ?? null),
      );
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: [VAULT_SCOPE] }) <= 1) {
        runDeferredReads(client);
      }
    },
  });

  return React.useCallback(
    async (input: SaveNoteInput) => {
      await mutateAsync(input);
    },
    [mutateAsync],
  );
}
