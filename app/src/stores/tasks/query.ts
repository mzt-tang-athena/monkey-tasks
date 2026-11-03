import {
  queryOptions,
  replaceEqualDeep,
  type QueryClient,
} from "@tanstack/react-query";
import type { VaultAdapter } from "@/lib/vault/adapter";
import type { BrokenList, ListItem, TaskItem } from "@/types/task";
import { loadVault } from "./load-vault";
import { vaultIdle } from "./read-gate";
import { carryIds } from "./rows";

/** What the list query caches: the folder the rows came from, the rows,
 * and the list notes that become the extra tabs. */
export type TaskListData = {
  tasksDir: string | null;
  tasks: TaskItem[];
  lists: ListItem[];
  /** Notes in Lists/ that fail validation: shown, never dropped. */
  broken: BrokenList[];
};

/** The first part of every task list key. */
export const TASKS_KEY = "tasks";

/** The cache entry for the rows read from one granted root. */
export function tasksKey(root: string | null): readonly [string, string | null] {
  return [TASKS_KEY, root];
}

/**
 * Every write to the list cache, a read or a tap, keeps the row ids
 * the cache already had, and then keeps each unchanged object, so a
 * row that did not change does not render again.
 */
export function shareRows(old: unknown, next: unknown): unknown {
  const before = old as TaskListData | undefined;
  const after = next as TaskListData;
  const tasks = carryIds(before?.tasks, after.tasks);
  return replaceEqualDeep(
    before,
    tasks === after.tasks ? after : { ...after, tasks },
  );
}

/** The rows in the cache now, or none before the first read. */
export function cachedRows(
  client: QueryClient,
  root: string | null,
): TaskItem[] {
  return client.getQueryData<TaskListData>(tasksKey(root))?.tasks ?? [];
}

/**
 * The read of one granted root. It waits until no vault write is
 * pending, then scans the Tasks folder (ADR 0017). With no root there
 * is nothing to read.
 */
export function tasksQueryOptions(
  adapter: VaultAdapter,
  root: string | null,
  client: QueryClient,
) {
  return queryOptions({
    queryKey: tasksKey(root),
    queryFn: async ({ signal }): Promise<TaskListData> => {
      await vaultIdle(client, signal);
      return loadVault(adapter, root as string);
    },
    enabled: root != null,
    networkMode: "always",
    // A cache entry never goes stale on its own, so focus must ask for
    // the read rather than wait for a staleness check to allow it: the
    // return to the foreground is when the vault wins over the local
    // list.
    refetchOnWindowFocus: "always",
    structuralSharing: shareRows,
  });
}
