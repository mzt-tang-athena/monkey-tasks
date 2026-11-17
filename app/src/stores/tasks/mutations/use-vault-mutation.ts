import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { VaultAdapter } from "@/lib/vault/adapter";
import { useVault } from "@/lib/vault/vault-provider";
import type { TaskItem } from "@/types/task";
import { cachedRows, tasksKey, type TaskListData } from "../query";
import { VAULT_SCOPE, deferRead, runDeferredReads } from "@/lib/vault/read-gate";
import { syncTaskReminders } from "../reminder-sync";
import { PENDING, rowById } from "../rows";
import { taskFromText } from "../task-notes";

/** What a write can reach while it runs. */
export type VaultIo = {
  adapter: VaultAdapter;
  /** The granted folder, or null when there is none. */
  root: string | null;
  /** The rows in the cache when this is called. */
  rows(): TaskItem[];
};

/** One task's alarms before and after a write, for `syncTaskReminders`. */
export type AlarmMove = readonly [TaskItem | null, TaskItem | null];

/** What the failure list reads from a vault mutation's `meta`. */
export type VaultMeta = {
  label: string;
  /** False when the caller shows the failure itself. */
  listed: boolean;
};

export type VaultMutationSpec<V, R, C> = {
  /** Names the write in a failure. */
  label: string;
  /**
   * False when the caller shows the failure itself, as the capture bar
   * and the editor do. Such a write still rejects its promise.
   */
  listed?: boolean;
  /** Change the rows in the same frame as the tap. */
  optimistic?(rows: TaskItem[], v: V): { rows: TaskItem[]; context: C };
  /** The file work. It runs when the writes before it have settled. */
  run(v: V, io: VaultIo): Promise<R>;
  /**
   * Land the result on the rows that still hold this write's text.
   * `last` is true when no other vault write is pending, so no later
   * tap holds a newer text and the file is the truth.
   */
  settle?(
    rows: TaskItem[],
    v: V,
    r: R,
    c: C | undefined,
    last: boolean,
  ): TaskItem[];
  /** Undo the optimistic step on the rows that still hold its text. */
  rollback?(
    rows: TaskItem[],
    v: V,
    c: C | undefined,
    error: unknown,
  ): TaskItem[];
  /** The tasks whose alarms the write moved. */
  alarms?(r: R): AlarmMove[];
  /**
   * The tasks whose alarms a failed write moved anyway, because it left
   * a note on disk.
   */
  errorAlarms?(error: unknown, v: V): AlarmMove[];
};

/** Write the rows of one cache entry through an updater. */
function updateRows(
  client: QueryClient,
  root: string | null,
  change: (rows: TaskItem[]) => TaskItem[],
): void {
  client.setQueryData<TaskListData>(tasksKey(root), (old) => {
    const rows = old?.tasks ?? [];
    const next = change(rows);
    if (next === rows) {
      return old;
    }
    return {
      tasksDir: old?.tasksDir ?? null,
      tasks: next,
      lists: old?.lists ?? [],
      broken: old?.broken ?? [],
    };
  });
}

/**
 * Every vault write is one of these (ADR 0037). All of them share one
 * scope, so writes run one at a time in call order.
 *
 * `onMutate` runs at `mutate()` time, even while the write waits for
 * its turn. It cancels a read in flight first, and then changes the
 * rows through the cache's updater, so a second tap builds on the
 * first. Both steps run before `mutate()` returns, so two taps apply
 * in call order. The last write to settle runs a read it cancelled.
 */
export function useVaultMutation<V, R, C = undefined>(
  spec: VaultMutationSpec<V, R, C>,
) {
  const client = useQueryClient();
  const { adapter, root } = useVault();
  const meta: VaultMeta = { label: spec.label, listed: spec.listed ?? true };
  return useMutation<R, Error, V, C | undefined>({
    mutationKey: [VAULT_SCOPE, spec.label],
    scope: { id: VAULT_SCOPE },
    networkMode: "always",
    // A failure stays listed until it is dismissed or retried.
    gcTime: meta.listed ? Infinity : undefined,
    meta,
    onMutate: async (v) => {
      const cancelled = deferRead(client, tasksKey(root));
      let context: C | undefined;
      const { optimistic } = spec;
      if (optimistic != null) {
        updateRows(client, root, (rows) => {
          const step = optimistic(rows, v);
          context = step.context;
          return step.rows;
        });
      }
      await cancelled;
      return context;
    },
    mutationFn: (v) =>
      spec.run(v, { adapter, root, rows: () => cachedRows(client, root) }),
    onSuccess: (r, v, c) => {
      const { settle } = spec;
      if (settle != null) {
        // This write still counts as pending here.
        const last = client.isMutating({ mutationKey: [VAULT_SCOPE] }) <= 1;
        updateRows(client, root, (rows) => settle(rows, v, r, c, last));
      }
      for (const [before, after] of spec.alarms?.(r) ?? []) {
        void syncTaskReminders(before, after);
      }
    },
    onError: (error, v, c) => {
      const { rollback } = spec;
      if (rollback != null) {
        updateRows(client, root, (rows) => rollback(rows, v, c, error));
      }
      for (const [before, after] of spec.errorAlarms?.(error, v) ?? []) {
        void syncTaskReminders(before, after);
      }
    },
    onSettled: () => {
      // This write still counts as pending here. When it is the only
      // one, the queue is about to drain.
      if (client.isMutating({ mutationKey: [VAULT_SCOPE] }) <= 1) {
        runDeferredReads(client);
      }
    },
  });
}

/** The row with this id, or a failure that names the missing task. */
export function requireRow(rows: readonly TaskItem[], id: string): TaskItem {
  const row = rowById(rows, id);
  if (row == null) {
    throw new Error("the task is no longer in the list");
  }
  if (row.uri.startsWith(PENDING)) {
    throw new Error("the task's note was never made");
  }
  return row;
}

/**
 * The row as its file holds it now. A write applies its change to this,
 * not to the cached row, so a change another app made survives. A note
 * whose frontmatter no longer parses cannot take the change.
 */
export async function readRow(
  adapter: VaultAdapter,
  row: TaskItem,
): Promise<TaskItem & { data: TaskFrontmatter }> {
  const fresh = taskFromText(row, await adapter.read(row.uri));
  if (fresh.data == null) {
    throw new Error(`${row.fileName} has no readable frontmatter`);
  }
  return { ...fresh, data: fresh.data };
}

/** The text of a failure, without the "Error: " prefix. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
