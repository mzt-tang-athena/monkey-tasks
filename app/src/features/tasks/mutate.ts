import { updateProperty, writeNote } from "../vault/notes";
import { todayIso } from "../../lib/dates";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
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

/**
 * Write several frontmatter properties in one pass. Each key edits the
 * text the previous key produced, and the file is written once, so a
 * multi-key patch cannot drop the earlier edits.
 */
export async function setProperties(
  task: TaskItem,
  patch: Partial<TaskFrontmatter>,
): Promise<string> {
  let text = task.text;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    text = updateProperty(text, key, value as string | string[] | null);
  }
  if (text !== task.text) {
    await writeNote(task.uri, text);
  }
  return text;
}
