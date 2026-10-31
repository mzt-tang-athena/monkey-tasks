import type { VaultAdapter } from "@/lib/vault/adapter";
import { loadLists } from "./list-notes";
import type { BrokenList, ListItem, TaskItem } from "@/types/task";
import { loadTasks } from "./task-notes";

/** The folder under the granted root that holds the task notes. */
export const TASKS_FOLDER = "Tasks";

/**
 * The vault session for one granted root: the Tasks folder inside it,
 * the task notes in that folder, and the lists their tabs come from.
 *
 * The root is the folder the user picked. The Tasks folder is derived
 * from the root on every load, so a reload can never read from the
 * wrong place. A read never creates the folder: a slow listing that
 * misses it would make a second one. With no Tasks folder the vault
 * has no rows, and the first capture makes the folder.
 */
export async function loadVault(
  adapter: VaultAdapter,
  root: string,
): Promise<{
  tasksDir: string | null;
  tasks: TaskItem[];
  lists: ListItem[];
  broken: BrokenList[];
}> {
  const tasksDir = await adapter.findFolder(root, TASKS_FOLDER);
  if (tasksDir == null) {
    return { tasksDir: null, tasks: [], lists: [], broken: [] };
  }
  const [tasks, { lists, broken }] = await Promise.all([
    loadTasks(adapter, tasksDir),
    loadLists(adapter, tasksDir),
  ]);
  return { tasksDir, tasks, lists, broken };
}

/** The Tasks folder under the root. A write makes it when it is missing. */
export async function ensureTasksFolder(
  adapter: VaultAdapter,
  root: string,
): Promise<string> {
  return (
    (await adapter.findFolder(root, TASKS_FOLDER)) ??
    (await adapter.makeFolder(root, TASKS_FOLDER))
  );
}
