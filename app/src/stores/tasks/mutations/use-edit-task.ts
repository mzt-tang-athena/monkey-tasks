import * as React from "react";
import { saveTaskEdit } from "@/lib/vault/save-task-edit";
import type { TaskEdit, TaskItem } from "@/types/task";
import { settleRow } from "../rows";
import {
  requireRow,
  useVaultMutation,
  type VaultMutationSpec,
} from "./use-vault-mutation";
import type { Written } from "./use-patch-task";

export type EditVariables = {
  id: string;
  edit: TaskEdit;
  /**
   * The note text the editor opened. A save built on a stale draft
   * refuses instead of overwriting a change that landed after the
   * editor seeded (ADR 0017).
   */
  expected: string;
};

const spec: VaultMutationSpec<EditVariables, Written, undefined> = {
  label: "edit",
  // The editor waits for the save and shows a refusal itself.
  listed: false,
  async run({ id, edit, expected }, io) {
    const before = requireRow(io.rows(), id);
    const after = await saveTaskEdit(io.adapter, before, edit, expected);
    return { before, after };
  },
  // The save checked that the file held `expected`. A row that holds
  // other text took a later tap, which settles it. A rename changes the
  // uri and keeps the id either way.
  settle: (rows, { id, expected }, r) => settleRow(rows, id, expected, r.after),
  // The alarm ids are keyed by uri, so a renamed note drops its old
  // alarms before the new uri schedules its own.
  alarms: (r) =>
    r.before.uri === r.after.uri
      ? [[r.before, r.after]]
      : [
          [r.before, null],
          [null, r.after],
        ],
};

/**
 * Save the editor's fields to the note. No optimistic step: the editor
 * waits, and the promise rejects when the save fails.
 */
export function useEditTask(): (
  task: TaskItem,
  edit: TaskEdit,
  expected?: string,
) => Promise<void> {
  const { mutateAsync } = useVaultMutation(spec);
  return React.useCallback(
    async (task, edit, expected) => {
      await mutateAsync({ id: task.id, edit, expected: expected ?? task.text });
    },
    [mutateAsync],
  );
}
