import { parseFrontmatter } from "@monkey-tasks/schemas";
import type { TaskEdit, TaskItem } from "@/types/task";

/** The draft the editor holds: the vault fields, plain. */
export function draftOf(task: TaskItem): TaskEdit {
  return {
    name: task.data?.title ?? task.name,
    due: task.data?.due ?? null,
    recurrence: task.data?.recurrence ?? null,
    lists: (task.data?.lists ?? []).map(listName),
    reminders: task.data?.reminders ?? [],
    body: task.body,
  };
}

/** "[[Focus]]" -> "Focus"; a bare value passes through. */
export function listName(link: string): string {
  const trimmed = link.trim();
  return trimmed.startsWith("[[") && trimmed.endsWith("]]")
    ? trimmed.slice(2, -2)
    : trimmed;
}

/** The per-line input back to plain list names. */
export function parseLists(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(listName)
    .filter((name) => name !== "");
}

/** Reminder datetimes, one per line. */
export function parseReminders(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** `decodeURIComponent`, or the value itself when it is not valid. */
export function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The route decodes params, and a SAF uri already carries percent
 * escapes of its own, so the id can arrive once or twice decoded.
 * Compare every form the route may hand back.
 */
export function findTask(tasks: TaskItem[], id: string): TaskItem | undefined {
  return (
    tasks.find((task) => task.id === id) ??
    tasks.find((task) => decode(task.id) === id) ??
    tasks.find((task) => task.id === decode(id))
  );
}

/**
 * The editor writes task frontmatter, so only a note whose kind is the
 * tasks wikilink may open in it. Save on any other note would rewrite
 * a deed or a plain note as a task.
 */
export function isTaskNote(task: TaskItem): boolean {
  const kind: unknown = task.data?.kind;
  return kind === "[[tasks]]";
}

/**
 * Frontmatter as the reader shows it: keys in file order with their
 * values, lists joined on one line. The vault parser already reads
 * the block between the --- fences, so a non-task note keeps every
 * property it carries.
 */
export function frontmatterEntries(text: string): [string, string][] {
  const { values } = parseFrontmatter("", text);
  return Object.entries(values).map(([key, value]): [string, string] => [
    key,
    Array.isArray(value) ? value.join(", ") : value ?? "",
  ]);
}
