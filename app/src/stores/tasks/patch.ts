import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { updateProperty } from "@/lib/vault/frontmatter";
import { takeTaskShape } from "@/lib/vault/task-kind";
import type { TaskItem } from "@/types/task";

/**
 * Apply a frontmatter patch in memory, with the same surgical edit the
 * write performs. The local text moves with the change, so the next tap
 * builds on this one instead of overwriting it, and the row can render
 * before any file I/O starts.
 *
 * A note read from `Deeds/` takes the task shape first, so an edit
 * writes the task kind and keeps every other property.
 *
 * An unreadable note has no frontmatter to edit, so it comes back
 * unchanged; the caller's write would have nothing to anchor to either.
 */
export function applyPatch(
  task: TaskItem,
  patch: Partial<TaskFrontmatter>,
): TaskItem {
  if (task.data == null) {
    return task;
  }
  let text = task.text;
  const data: Record<string, unknown> = { ...task.data };
  // A note read from Deeds/ takes the task shape first, and its data
  // moves with the text so a later tap builds on what was written.
  if (task.folder === "deeds") {
    const shaped = takeTaskShape(text, task.data.created != null);
    text = shaped.text;
    if (shaped.created != null) {
      data.created = shaped.created;
    }
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    text = updateProperty(
      text,
      key,
      value as string | string[] | number | null,
    );
    if (value === null) {
      delete data[key];
    } else {
      data[key] = value;
    }
  }
  return { ...task, text, data: data as TaskFrontmatter };
}
