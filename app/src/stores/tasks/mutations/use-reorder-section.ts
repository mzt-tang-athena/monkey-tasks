import * as React from "react";
import type { TaskItem } from "@/types/task";
import { applyPatch } from "../patch";
import { patchRow, rollbackRow, rowById, settleRow } from "../rows";
import {
  readRow,
  requireRow,
  useVaultMutation,
  type VaultMutationSpec,
} from "./use-vault-mutation";
import type { RowStep } from "./use-patch-task";

export type ReorderVariables = { changes: { id: string; order: number }[] };

type Steps = Map<string, RowStep>;

type Moved = { id: string; after: TaskItem }[];

const spec: VaultMutationSpec<ReorderVariables, Moved, Steps> = {
  label: "reorder",
  optimistic(rows, { changes }) {
    const steps: Steps = new Map();
    let next = rows;
    for (const { id, order } of changes) {
      const previous = rowById(next, id);
      if (previous == null) {
        continue;
      }
      const updated = applyPatch(previous, { order });
      steps.set(id, { previous, text: updated.text });
      next = patchRow(next, id, () => updated);
    }
    return { rows: next, context: steps };
  },
  async run({ changes }, io) {
    const moved: (Moved[number] & { order: number | null | undefined })[] = [];
    try {
      for (const { id, order } of changes) {
        const before = await readRow(io.adapter, requireRow(io.rows(), id));
        const after = applyPatch(before, { order });
        await io.adapter.write(before.uri, after.text);
        moved.push({ id, after, order: before.data.order });
      }
    } catch (error) {
      // A drop is one change: put back the numbers already written, as
      // far as that works, so the section never keeps mixed numbers.
      for (const { after, order } of moved.reverse()) {
        try {
          const now = await readRow(io.adapter, after);
          await io.adapter.write(
            after.uri,
            applyPatch(now, { order: order ?? null }).text,
          );
        } catch {
          // The note keeps the new number. The next read shows it.
        }
      }
      throw error;
    }
    return moved.map(({ id, after }) => ({ id, after }));
  },
  settle: (rows, _v, moved, steps) =>
    moved.reduce((next, { id, after }) => {
      const step = steps?.get(id);
      return step == null ? next : settleRow(next, id, step.text, after);
    }, rows),
  rollback: (rows, _v, steps) =>
    [...(steps ?? new Map<string, RowStep>()).entries()].reduce(
      (next, [id, step]) => rollbackRow(next, id, step.text, step.previous),
      rows,
    ),
};

/**
 * Write the new `order` of every row a drop moved, as one change. The
 * rows move at once. When one note cannot be written, the notes already
 * written get their old numbers back and every row rolls back. The
 * promise settles when the writes do and never rejects.
 */
export function useReorderSection(): (
  changes: { task: TaskItem; order: number }[],
) => Promise<void> {
  const { mutateAsync } = useVaultMutation(spec);
  return React.useCallback(
    async (changes) => {
      if (changes.length === 0) {
        return;
      }
      await mutateAsync({
        changes: changes.map(({ task, order }) => ({ id: task.id, order })),
      }).catch(() => undefined);
    },
    [mutateAsync],
  );
}
