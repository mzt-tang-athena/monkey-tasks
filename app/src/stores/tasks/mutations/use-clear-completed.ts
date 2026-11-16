import * as React from "react";
import type { TaskItem } from "@/types/task";
import { insertRow, rowById } from "../rows";
import { useRefreshTasks } from "../use-vault-read";
import {
  messageOf,
  useVaultMutation,
  type AlarmMove,
  type VaultMutationSpec,
} from "./use-vault-mutation";

/** The notes the user confirmed, read when the sheet opened. */
export type ClearCompletedVariables = { tasks: TaskItem[] };

/** The notes a clear removed, and the ones that stayed. */
export type Cleared = {
  removed: TaskItem[];
  kept: TaskItem[];
  /** Names the notes that stayed, for the notice banner. */
  notice?: string;
};

/** A stayed-note line: how many stayed, and why the first one did. */
function stayed(count: number, total: number, message: string): string {
  return `${count} of ${total} completed tasks stayed: ${message}`;
}

const spec: VaultMutationSpec<
  ClearCompletedVariables,
  Cleared,
  TaskItem[] | undefined
> = {
  label: "clear completed",
  optimistic(rows, { tasks }) {
    const gone = new Set(tasks.map((task) => task.id));
    const previous = rows.filter((row) => gone.has(row.id));
    if (previous.length === 0) {
      return { rows, context: undefined };
    }
    return {
      rows: rows.filter((row) => !gone.has(row.id)),
      context: previous,
    };
  },
  async run({ tasks }, io) {
    const removed: TaskItem[] = [];
    const kept: { task: TaskItem; message: string }[] = [];
    // One note per task, so a lock on one note never stops the rest.
    for (const task of tasks) {
      try {
        await io.adapter.remove(task.uri);
        removed.push(task);
      } catch (error) {
        kept.push({ task, message: messageOf(error) });
      }
    }
    if (kept.length > 0 && removed.length === 0) {
      // A clear that deleted nothing is a failed write: the rows come
      // back and the failure banner offers Retry.
      throw new Error(stayed(kept.length, tasks.length, kept[0].message));
    }
    return {
      removed,
      kept: kept.map(({ task }) => task),
      notice:
        kept.length === 0
          ? undefined
          : stayed(kept.length, tasks.length, kept[0].message),
    };
  },
  settle(rows, _v, r) {
    // The rows left in the optimistic step. The notes that stayed come
    // back, and the ones that went stay gone.
    return r.kept.reduce(
      (next, task) =>
        rowById(next, task.id) == null ? insertRow(next, task) : next,
      rows,
    );
  },
  rollback(rows, _v, previous) {
    return (previous ?? []).reduce(
      (next, task) =>
        rowById(next, task.id) == null ? insertRow(next, task) : next,
      rows,
    );
  },
  alarms(r): AlarmMove[] {
    return r.removed.map((task) => [task, null]);
  },
};

/**
 * Delete the notes of the completed tasks the user confirmed. The rows
 * leave at once. A note that cannot be deleted comes back, and the
 * notice names how many stayed. The promise settles when the writes do
 * and never rejects. A finished write reads the vault again, so the
 * list shows what the folder holds.
 */
export function useClearCompleted(): (tasks: readonly TaskItem[]) => Promise<void> {
  const { mutateAsync } = useVaultMutation(spec);
  const refresh = useRefreshTasks();
  return React.useCallback(
    async (tasks) => {
      if (tasks.length === 0) {
        return;
      }
      try {
        await mutateAsync({ tasks: [...tasks] });
      } catch {
        // The failure list carries it.
      } finally {
        await refresh();
      }
    },
    [mutateAsync, refresh],
  );
}
