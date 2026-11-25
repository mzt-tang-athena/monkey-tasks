import type { VaultAdapter } from "@/lib/vault/adapter";
import { loadLists } from "./list-notes";
import type { BrokenList, ListItem, TaskItem } from "@/types/task";
import { isReferenceNote, loadTasks } from "./task-notes";

/** The folder under the granted root that holds the task notes. */
export const TASKS_FOLDER = "Tasks";

/**
 * The folder that holds the deed notes. A deed is a task with a
 * status, so it reads with the same schema and lands in the same rows
 * (ADR `20261124-deeds-are-tasks-with-a-status`).
 */
export const DEEDS_FOLDER = "Deeds";

/**
 * The vault session for one granted root: the two folders the app
 * reads work from, the task and deed notes in them, and the lists
 * their tabs come from.
 *
 * The root is the folder the user picked. The folders are derived from
 * the root on every load, so a reload can never read from the wrong
 * place. A read never creates a folder: a slow listing that misses one
 * would make a second. With no Tasks folder there are no list tabs, and
 * the first capture makes the folder.
 *
 * A deed note with a status is a deed. One without is a reference note,
 * and the vault tidy moves those to `Notes/` later, so they show
 * nowhere for now.
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
  const [tasksDir, deedsDir] = await Promise.all([
    adapter.findFolder(root, TASKS_FOLDER),
    adapter.findFolder(root, DEEDS_FOLDER),
  ]);
  const [tasks, { lists, broken }, deeds] = await Promise.all([
    loadTasks(adapter, tasksDir),
    tasksDir == null
      ? Promise.resolve({ lists: [], broken: [] })
      : loadLists(adapter, tasksDir),
    loadTasks(adapter, deedsDir, "deeds"),
  ]);
  const deedRows = deeds.filter((row) => !isReferenceNote(row));
  return { tasksDir, tasks: [...tasks, ...deedRows], lists, broken };
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
