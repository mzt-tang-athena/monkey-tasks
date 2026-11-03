import { replaceEqualDeep } from "@tanstack/react-query";
import type { BrokenList, ListItem, TaskItem } from "@/types/task";
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
