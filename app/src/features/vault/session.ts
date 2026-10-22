import { ensureSubfolder } from "./scan";
import { loadTasks, type TaskItem } from "../tasks/query";

/**
 * The vault session for one granted root: the Tasks folder inside it
 * and the task notes in that folder.
 *
 * The root is the folder the user picked. The Tasks folder is derived
 * from the root on every load, so a reload can never read from the
 * wrong place.
 */
export async function loadVaultTasks(root: string): Promise<{
  tasksDir: string;
  tasks: TaskItem[];
}> {
  const tasksDir = await ensureSubfolder(root, "Tasks");
  const tasks = await loadTasks(tasksDir);
  return { tasksDir, tasks };
}
