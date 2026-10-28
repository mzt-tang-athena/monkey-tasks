import { safeFileName } from "@/lib/vault/file-name";
import { updateProperty } from "@/lib/vault/frontmatter";
import type { TaskItem } from "@/types/task";

/** Everything the next occurrence of a recurring task keeps. */
export type SpawnInput = {
  title: string;
  /** The completed note's file name without ".md". */
  previous: string;
  /** Stored date or datetime of the next occurrence. */
  due: string;
  recurrence: string;
  /** Storage strings, for example "[[Focus]]". */
  lists: string[];
  /** Absolute datetimes for the next occurrence. */
  reminders: string[];
  body: string;
};

function link(name: string): string {
  return `[[${name}]]`;
}

/**
 * The new occurrence's file name: title and the due day, because a
 * series has no id and Obsidian resolves links by name. A name already
 * in the folder gets a counter, so two occurrences never collide.
 */
export function spawnFileName(
  title: string,
  due: string,
  taken: ReadonlySet<string>,
): string {
  const base = `${safeFileName(title)} ${due.slice(0, 10)}`;
  let candidate = `${base}.md`;
  for (let count = 2; taken.has(candidate); count += 1) {
    candidate = `${base} ${count}.md`;
  }
  return candidate;
}

/**
 * The next occurrence's note text: frontmatter through the one
 * serializer that quotes wikilinks and writes lists as blocks, then
 * the copied body.
 */
export function spawnContent(input: SpawnInput, created: string): string {
  const properties: [string, string | string[]][] = [
    ["kind", link("tasks")],
    ["created", created],
    ["title", input.title],
    ["due", input.due],
    ["recurrence", input.recurrence],
    ["lists", input.lists],
    ["reminders", input.reminders],
    ["recurrence previous", link(input.previous)],
  ];
  let text = "---\n\n---\n";
  for (const [key, value] of properties) {
    text = updateProperty(text, key, value);
  }
  return `${text}${input.body}`;
}

function sameOrder(
  actual: readonly string[] | null | undefined,
  expected: readonly string[],
): boolean {
  const values = actual ?? [];
  return (
    values.length === expected.length &&
    values.every((value, index) => value === expected[index])
  );
}

/**
 * Whether the note still holds exactly the occurrence spawn wrote.
 * Unticking deletes such a note; an edited or completed one is left
 * alone, because deleting it would drop the user's work.
 */
export function isUntouchedSpawn(
  spawn: TaskItem,
  expected: SpawnInput,
): boolean {
  const data = spawn.data;
  if (data == null || data.completed != null) {
    return false;
  }
  return (
    data.title === expected.title &&
    data.due === expected.due &&
    data.recurrence === expected.recurrence &&
    sameOrder(data.lists, expected.lists) &&
    sameOrder(data.reminders, expected.reminders) &&
    data["recurrence previous"] === link(expected.previous) &&
    spawn.body === expected.body
  );
}
