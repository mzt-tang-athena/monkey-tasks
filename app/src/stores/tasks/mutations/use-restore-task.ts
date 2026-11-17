import * as React from "react";
import type { TaskItem } from "@/types/task";
import { insertRow, removeRow, rowById, settleRow } from "../rows";
import { taskFromText } from "../task-notes";
import type { DeletedTask } from "./use-delete-task";
import { useVaultMutation, type VaultMutationSpec } from "./use-vault-mutation";

const spec: VaultMutationSpec<DeletedTask, TaskItem, TaskItem | undefined> = {
  label: "restore",
  // The editor's toast reports a failed restore.
  listed: false,
  optimistic(rows, { row }) {
    if (rowById(rows, row.id) != null) {
      return { rows, context: undefined };
    }
    return { rows: insertRow(rows, row), context: row };
  },
  async run({ row, text }, io) {
    // The same folder and file name. A provider that finds the name
    // taken again picks another, and the row follows the file it made.
    const made = await io.adapter.create(
      io.adapter.parentOf(row.uri),
      row.fileName,
      text,
    );
    return taskFromText(
      {
        id: row.id,
        uri: made.uri,
        fileName: made.fileName,
        name: made.fileName.replace(/\.md$/, ""),
      },
      text,
    );
  },
  settle: (rows, { row, text }, restored) => settleRow(rows, row.id, text, restored),
  rollback(rows, _v, shown) {
    return shown == null ? rows : removeRow(rows, shown.id);
  },
  // The note is back, so its alarms are too.
  alarms: (restored) => [[null, restored]],
};

/**
 * Put a deleted note back, with the exact text it held. The row shows
 * at once and leaves again when the write fails. The promise rejects
 * on a failure.
 */
export function useRestoreTask(): (deleted: DeletedTask) => Promise<TaskItem> {
  const { mutateAsync } = useVaultMutation(spec);
  return React.useCallback((deleted) => mutateAsync(deleted), [mutateAsync]);
}
