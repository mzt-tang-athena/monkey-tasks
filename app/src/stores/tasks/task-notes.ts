import { taskFrontmatter, validateNote } from "@monkey-tasks/schemas";
import { listDirectory, displayName, type Entry } from "@/lib/vault/scan";
import { readNote } from "@/lib/vault/notes";
import { formatIssues } from "@/utils/schema-errors";
import type { TaskItem } from "@/types/task";

/**
 * One task note as the store carries it, from its file text. The
 * vault read and the retry after a write conflict both build rows
 * here, so a re-read row is shaped like a loaded one.
 */
export function taskFromText(
  base: { id: string; uri: string; fileName: string; name: string },
  text: string,
): TaskItem {
  const result = validateNote(base.fileName, text, taskFrontmatter);
  return {
    ...base,
    text,
    data: result.data,
    body: result.note.body,
    name: result.data?.title ?? base.name,
    ...(result.errors == null
      ? {}
      : { errors: formatIssues(result.errors.issues) }),
  };
}

export async function loadTasks(tasksDirUri: string): Promise<TaskItem[]> {
  const entries: Entry[] = await listDirectory(tasksDirUri);
  const files = entries.filter((entry) => entry.isFile && entry.name.endsWith(".md"));
  // One unreadable entry (a folder named "Notes.md", a revoked grant)
  // must not blank the whole list, so failures are dropped per file.
  const settled = await Promise.allSettled(
    files.map(async (file): Promise<TaskItem> => {
      const text = await readNote(file.uri);
      return taskFromText(
        {
          id: file.uri,
          uri: file.uri,
          fileName: file.name,
          // A spawned occurrence carries a date-suffixed file name, so
          // the display name comes from its title.
          name: displayName(file.uri).replace(/\.md$/, ""),
        },
        text,
      );
    }),
  );
  return settled.flatMap((outcome) =>
    outcome.status === "fulfilled" ? [outcome.value] : [],
  );
}
