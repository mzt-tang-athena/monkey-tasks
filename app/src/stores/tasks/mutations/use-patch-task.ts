import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { useVault } from "@/lib/vault/vault-provider";
import type { TaskItem } from "@/types/task";
import { applyPatch } from "../patch";
import { cachedRows } from "../query";
import { patchRow, rollbackRow, rowById, settleRow } from "../rows";
import {
  readRow,
  requireRow,
  useVaultMutation,
  type VaultMutationSpec,
} from "./use-vault-mutation";

export type PatchVariables = { id: string; patch: Partial<TaskFrontmatter> };

/** The row before the tap, and the text the tap put on it. */
export type RowStep = { previous: TaskItem; text: string };

/** A task note before and after one write. */
export type Written = { before: TaskItem; after: TaskItem };

const spec: VaultMutationSpec<PatchVariables, Written, RowStep | undefined> = {
  label: "change",
  optimistic(rows, { id, patch }) {
    const previous = rowById(rows, id);
    if (previous == null) {
      return { rows, context: undefined };
    }
    const updated = applyPatch(previous, patch);
    return {
      rows: patchRow(rows, id, () => updated),
      context: { previous, text: updated.text },
    };
  },
  async run({ id, patch }, io) {
    const before = await readRow(io.adapter, requireRow(io.rows(), id));
    const after = applyPatch(before, patch);
    await io.adapter.write(before.uri, after.text);
    return { before, after };
  },
  settle: (rows, { id }, r, c) =>
    c == null ? rows : settleRow(rows, id, c.text, r.after),
  rollback: (rows, { id }, c) =>
    c == null ? rows : rollbackRow(rows, id, c.text, c.previous),
  alarms: (r) => [[r.before, r.after]],
};

/**
 * Write one or more frontmatter fields of a task, as a drag to a day
 * does. The row changes at once. A patch that changes nothing on the
 * row writes nothing. The promise settles when the write does and
 * never rejects: a failure goes to the failure list.
 */
export function usePatchTask(): (
  task: TaskItem,
  patch: Partial<TaskFrontmatter>,
) => Promise<void> {
  const client = useQueryClient();
  const { root } = useVault();
  const { mutateAsync } = useVaultMutation(spec);
  return React.useCallback(
    async (task, patch) => {
      const current = rowById(cachedRows(client, root), task.id) ?? task;
      if (applyPatch(current, patch).text === current.text) {
        return;
      }
      await mutateAsync({ id: current.id, patch }).catch(() => undefined);
    },
    [client, root, mutateAsync],
  );
}
