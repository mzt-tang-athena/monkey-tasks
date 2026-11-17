import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appendEntry } from "@/lib/journal/daily-note";
import {
  blockId,
  parseDailyNote,
  planAppend,
  type JournalEntryDraft,
} from "@/lib/journal/format";
import { markLanded } from "@/lib/motion/entrances";
import { NoteChangedError } from "@/lib/vault/notes";
import { VAULT_SCOPE, deferRead, runDeferredReads } from "@/lib/vault/read-gate";
import { useVault } from "@/lib/vault/vault-provider";
import { cachedNote, journalKey } from "../query";

/**
 * The journal's one write. The send appends the block to the cached
 * text in the same frame as the tap, and the file work runs behind it.
 *
 * The cached text is the single source of truth, and the optimistic
 * step is `planAppend`, the same function the file write uses, so the
 * block on screen is the block that lands.
 *
 * The write shares `VAULT_SCOPE` with the task writes, so the vault is
 * never written twice at once. It stays out of the Lists failure
 * banner: the composer shows this failure with the draft kept.
 */

type AppendContext = {
  /** The text before the optimistic step, for a rollback. */
  before: string;
  /** False when nothing was appended to the cache. */
  changed: boolean;
};

/**
 * Append one draft. The promise rejects when the write fails, so the
 * composer keeps the draft and retries. A retry is a new call, so it
 * re-reads the note and never clobbers another app's edit.
 */
export function useAppendEntry(
  day: string,
): (draft: JournalEntryDraft) => Promise<void> {
  const client = useQueryClient();
  const { adapter, root } = useVault();
  const key = journalKey(root, day);

  const { mutateAsync } = useMutation<
    { text: string },
    Error,
    JournalEntryDraft,
    AppendContext
  >({
    mutationKey: [VAULT_SCOPE, "journal entry"],
    scope: { id: VAULT_SCOPE },
    networkMode: "always",
    meta: { label: "journal entry", listed: false },
    onMutate: async (draft) => {
      const cancelled = deferRead(client, key);
      const before = cachedNote(client, root, day) ?? "";
      const plan = planAppend(before, draft.block, { retry: draft.retry });
      if (!plan.appended) {
        await cancelled;
        return { before, changed: false };
      }
      // The block mounts under this id, so its rise is the only thing
      // that finds the mark. The parser gives the same id back.
      markLanded(blockId(draft.block, parseDailyNote(before).length));
      client.setQueryData<string>(key, plan.text);
      await cancelled;
      return { before, changed: true };
    },
    mutationFn: async (draft) => {
      if (root == null) {
        throw new Error("connect a vault folder first");
      }
      const result = await appendEntry(adapter, root, {
        day,
        block: draft.block,
        retry: draft.retry,
      });
      return { text: result.text };
    },
    onSuccess: (result, draft, context) => {
      if (context == null || !context.changed) {
        return;
      }
      // While another vault write waits behind this one the cache may
      // hold a newer block: keep it. The last write settles the cache on
      // the file, which is then the truth.
      if (client.isMutating({ mutationKey: [VAULT_SCOPE] }) > 1) {
        return;
      }
      client.setQueryData<string>(key, result.text);
    },
    onError: (error, draft, context) => {
      if (context == null) {
        return;
      }
      const planned = planAppend(context.before, draft.block, {
        retry: draft.retry,
      });
      // Undo only if the cache still holds this write's text. A newer
      // optimistic block keeps its own rollback.
      if (context.changed && cachedNote(client, root, day) === planned.text) {
        client.setQueryData<string>(key, context.before);
      }
      // Another app wrote the note between our read and our write. Read
      // it again, so the operator sees the real page before Retry
      // appends to it.
      if (error instanceof NoteChangedError) {
        void client.invalidateQueries({ queryKey: key, exact: true });
      }
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: [VAULT_SCOPE] }) <= 1) {
        runDeferredReads(client);
      }
    },
  });

  return React.useCallback(
    async (draft: JournalEntryDraft) => {
      await mutateAsync(draft);
    },
    [mutateAsync],
  );
}
