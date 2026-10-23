import { ensureSubfolder } from "./scan";
import { loadLists, type ListItem } from "../lists/query";
import { loadTasks, type TaskItem } from "../tasks/query";

/**
 * The vault session for one granted root: the Tasks folder inside it,
 * the task notes in that folder, and the lists their tabs come from.
 *
 * The root is the folder the user picked. The Tasks folder is derived
 * from the root on every load, so a reload can never read from the
 * wrong place.
 */
export async function loadVaultTasks(root: string): Promise<{
  tasksDir: string;
  tasks: TaskItem[];
  lists: ListItem[];
}> {
  const tasksDir = await ensureSubfolder(root, "Tasks");
  const [tasks, lists] = await Promise.all([
    loadTasks(tasksDir),
    loadLists(tasksDir),
  ]);
  return { tasksDir, tasks, lists };
}
