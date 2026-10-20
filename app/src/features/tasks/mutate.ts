import { updateProperty, writeNote } from "../vault/notes";
import { todayIso } from "../../lib/dates";
import type { TaskItem } from "./query";

/**
 * Tick (writes completed with today's date) or untick (removes
 * completed). Tasks are done through the completed date only.
 */
export async function setCompleted(
  task: TaskItem,
  completed: boolean,
): Promise<string> {
  const text = completed
    ? updateProperty(task.text, "completed", todayIso())
    : updateProperty(task.text, "completed", null);
  await writeNote(task.uri, text);
  return text;
}

/** Write any single frontmatter property on a task note. */
export async function setProperty(
  task: TaskItem,
  key: string,
  value: string | string[] | null,
): Promise<string> {
  const text = updateProperty(task.text, key, value);
  await writeNote(task.uri, text);
  return text;
}
