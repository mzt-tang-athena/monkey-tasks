import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { updateProperty } from "@/lib/vault/frontmatter";
import type { TaskItem } from "@/types/task";

/**
 * Apply a frontmatter patch in memory, with the same surgical edit the
 * write performs. The local text moves with the change, so the next tap
 * builds on this one instead of overwriting it, and the row can render
 * before any file I/O starts.
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
