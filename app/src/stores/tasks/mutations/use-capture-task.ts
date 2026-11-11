import * as React from "react";
import { markLanded } from "@/lib/motion/entrances";
import { createNote } from "@/lib/vault/notes";
import type { CaptureTarget, ParsedCapture, TaskItem } from "@/types/task";
import { captureDraft } from "../capture-draft";
import { ensureTasksFolder } from "../load-vault";
import { insertRow, pendingId, removeRow, settleRow } from "../rows";
import { taskFromText } from "../task-notes";
import {
  useVaultMutation,
  type VaultMutationSpec,
} from "./use-vault-mutation";

export type CaptureVariables = {
  /** The row's provisional id. It stays the row's id after the file lands. */
  id: string;
  draft: ReturnType<typeof captureDraft>;
};

const spec: VaultMutationSpec<CaptureVariables, TaskItem, undefined> = {
  label: "capture",
  // The capture bar shows its own failure, with the draft kept for
  // Retry.
  listed: false,
  // The row appears before the folder lookup and the file (ADR 0021).
  optimistic: (rows, { id, draft }) => ({
    rows: insertRow(rows, {
      id,
      uri: id,
      fileName: draft.fileName,
      name: draft.name,
      text: draft.content,
      data: draft.data,
      body: "",
    }),
    context: undefined,
  }),
  async run({ id, draft }, io) {
    if (io.root == null) {
      throw new Error("connect a vault folder first");
    }
    // A vault with no Tasks folder gets one with its first note. Writes
    // run one at a time, so two captures never make two folders.
    const folder = await ensureTasksFolder(io.adapter, io.root);
    // The provider may add " (1)" to the name. The note then carries
    // the typed name as its title, and the row takes the text that
    // really landed, so the next write builds on the right text.
    const created = await createNote(
      io.adapter,
      folder,
      draft.fileName,
      draft.content,
      draft.name,
    );
    return taskFromText(
      { id, uri: created.uri, fileName: created.fileName, name: draft.name },
      created.text,
    );
  },
  settle: (rows, { id, draft }, created) =>
    settleRow(rows, id, draft.content, created),
  rollback: (rows, { id }) => removeRow(rows, id),
  alarms: (created) => [[null, created]],
};

/**
 * Capture a task. Its row shows at once and keeps its id after the
 * file lands. The promise rejects when the note could not be made, so
 * the capture bar can offer the same draft again.
 */
export function useCaptureTask(): (
  parsed: ParsedCapture,
  target: CaptureTarget,
  preselectedDue?: string,
) => Promise<void> {
  const { mutateAsync } = useVaultMutation(spec);
  return React.useCallback(
    async (parsed, target, preselectedDue) => {
      const id = pendingId();
      // The row mounts under this id first, so its landing is the only
      // thing that finds the mark. The remount under its file uri
      // finds nothing (ticket 0060).
      markLanded(id);
      await mutateAsync({
        id,
        draft: captureDraft(parsed, target, preselectedDue),
      });
    },
    [mutateAsync],
  );
}
