import * as React from "react";
import type { TaskItem } from "@/types/task";
import { insertRow, rowById } from "../rows";
import { taskFromText } from "../task-notes";
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

/**
 * Why a note no longer holds a completion. The sheet's set is fixed
 * when it opens, so another app can reopen a note while the
 * confirmation is up. The delete reads the note again, and a note that
 * changed stays.
 */
function notCompleted(fresh: TaskItem): string {
  return fresh.data == null
    ? "its frontmatter no longer reads"
    : "it was reopened";
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
    let deleteAttempts = 0;
    // One note per task, so a lock on one note never stops the rest.
    for (const task of tasks) {
      // The gap between this read and the remove is the read-then-act
      // window `writeNoteIfUnchanged` documents: the adapter has no
      // conditional delete, so another app can still land in between.
      let text: string;
      try {
        text = await io.adapter.read(task.uri);
      } catch {
        // The note left the vault, or the provider refused the read.
        // The provider's own message names an internal uri, so the
        // notice says what the user can act on instead.
        kept.push({ task, message: "its note is missing or unreadable" });
        continue;
      }
      const fresh = taskFromText(task, text);
      if (fresh.data?.completed == null) {
        kept.push({ task, message: notCompleted(fresh) });
        continue;
      }
      deleteAttempts += 1;
      try {
        await io.adapter.remove(task.uri);
        removed.push(task);
      } catch (error) {
        kept.push({ task, message: messageOf(error) });
      }
    }
    if (kept.length > 0 && removed.length === 0 && deleteAttempts > 0) {
      // A clear whose deletes all failed is a failed write: the rows
      // come back and the failure banner offers Retry. A clear that
      // found every note reopened deleted nothing by design, so it
      // lands with a notice instead.
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
 * Delete the notes of the completed tasks the user confirmed, after
 * reading each note again. The rows leave at once. A note that no
 * longer holds a completion, or that cannot be read or deleted, comes
 * back, and the notice names how many stayed. The promise settles when
 * the writes do and never rejects. A finished write reads the vault
 * again, so the list shows what the folder holds.
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
