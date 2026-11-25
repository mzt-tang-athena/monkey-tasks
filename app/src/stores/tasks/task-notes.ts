import { taskFrontmatter, taskWarnings, validateNote } from "@monkey-tasks/schemas";
import type { VaultAdapter } from "@/lib/vault/adapter";
import { formatIssues } from "@/utils/schema-errors";
import type { TaskItem } from "@/types/task";
import { timed, timedAsync } from "@/lib/startup-marks";

/** The base fields of a row, before its file text is read. */
export type TaskBase = {
  id: string;
  uri: string;
  fileName: string;
  name: string;
  /** Set for a note in `Deeds/`; absent means `Tasks/`. */
  folder?: TaskItem["folder"];
};

/**
 * A note in `Deeds/` with no status is a reference note, not a deed.
 * It shows nowhere for now, until the vault tidy moves it to `Notes/`
 * (ticket `20261124-deed-vault-tidy`).
 */
export function isReferenceNote(row: TaskItem): boolean {
  return row.folder === "deeds" && row.data?.status == null;
}

/**
 * One task note as the store carries it, from its file text. The
 * vault read and the retry after a write conflict both build rows
 * here, so a re-read row is shaped like a loaded one.
 */
export function taskFromText(base: TaskBase, text: string): TaskItem {
  const result = validateNote(base.fileName, text, taskFrontmatter);
  const row: TaskItem = {
    ...base,
    text,
    data: result.data,
    body: result.note.body,
    name: result.data?.title ?? base.name,
  };
  if (result.errors != null) {
    return { ...row, errors: formatIssues(result.errors.issues) };
  }
  const warnings =
    result.data == null ? [] : taskWarnings(result.note.values);
  return warnings.length > 0 ? { ...row, warnings } : row;
}

export async function loadTasks(
  adapter: VaultAdapter,
  dirUri: string | null,
  folder?: TaskItem["folder"],
): Promise<TaskItem[]> {
  if (dirUri == null) {
    return [];
  }
  const entries = await timedAsync("list", () => adapter.list(dirUri));
  const files = entries.filter(
    (entry) => !entry.isFolder && entry.name.endsWith(".md"),
  );
  // One unreadable entry (a folder named "Notes.md", a revoked grant)
  // must not blank the whole list, so failures are dropped per file.
  const settled = await Promise.allSettled(
    files.map(async (file): Promise<TaskItem> => {
      const text = await timedAsync("read", () => adapter.read(file.uri));
      return timed("parse", () => taskFromText(
        {
          id: file.uri,
          uri: file.uri,
          fileName: file.name,
          // A spawned occurrence carries a date-suffixed file name, so
          // the display name comes from its title.
          name: file.name.replace(/\.md$/, ""),
          ...(folder == null ? {} : { folder }),
        },
        text,
      ));
    }),
  );
  return settled.flatMap((outcome) =>
    outcome.status === "fulfilled" ? [outcome.value] : [],
  );
}
