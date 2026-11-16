import * as React from "react";
import type { TaskItem } from "@/types/task";
import { insertRow, removeRow, rowById } from "../rows";
import { taskFromText } from "../task-notes";
import { useVaultMutation, type VaultMutationSpec } from "./use-vault-mutation";

/** A deleted note: its row, and the exact text its file held. */
export type DeletedTask = { row: TaskItem; text: string };

type DeleteVariables = {
  /** The row as the editor last saw it. Its file is the one to remove. */
  row: TaskItem;
};

const spec: VaultMutationSpec<DeleteVariables, DeletedTask, TaskItem | undefined> = {
  label: "delete",
  // The editor's toast reports a failed delete.
  listed: false,
  optimistic(rows, { row }) {
    const previous = rowById(rows, row.id);
    return { rows: removeRow(rows, row.id), context: previous };
  },
  async run({ row }, io) {
    // The text comes from the file, not the row, so Undo puts back the
    // bytes the vault held, even what another app wrote since the read.
    const text = await io.adapter.read(row.uri);
    await io.adapter.remove(row.uri);
    return { row: taskFromText(row, text), text };
  },
  rollback(rows, _v, previous) {
    return previous == null || rowById(rows, previous.id) != null
      ? rows
      : insertRow(rows, previous);
  },
  // A deleted note rings no more.
  alarms: (r) => [[r.row, null]],
};

/**
 * Remove a task's note. The row leaves at once and comes back when the
 * remove fails. The promise gives the file's text for Undo, and
 * rejects on a failure.
 */
export function useDeleteTask(): (row: TaskItem) => Promise<DeletedTask> {
  const { mutateAsync } = useVaultMutation(spec);
  return React.useCallback((row) => mutateAsync({ row }), [mutateAsync]);
}
