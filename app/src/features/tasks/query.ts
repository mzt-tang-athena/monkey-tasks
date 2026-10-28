import { taskFrontmatter, validateNote } from "@monkey-tasks/schemas";
import { listDirectory, displayName, type Entry } from "@/features/vault/scan";
import { readNote } from "@/features/vault/notes";
import { parseStoredDate, startOfDay } from "@/utils/dates";
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

export function inList(items: TaskItem[], listName: string): TaskItem[] {
  const link = `[[${listName}]]`;
  return items.filter((item) => item.data?.lists?.includes(link));
}

export type DateGroups = {
  overdue: TaskItem[];
  today: TaskItem[];
  upcoming: { date: Date; items: TaskItem[] }[];
  undated: TaskItem[];
  completed: TaskItem[];
};

/**
 * Group open tasks by due date and collect completed ones. Groups
 * break ties by title so ordering is stable.
 */
export function groupByDue(items: TaskItem[], now: Date): DateGroups {
  const today = startOfDay(now).getTime();
  const groups: DateGroups = {
    overdue: [],
    today: [],
    upcoming: [],
    undated: [],
    completed: [],
  };
  const byDay = new Map<number, { date: Date; items: TaskItem[] }>();
  for (const item of items) {
    const due = item.data?.completed
      ? null
      : item.data?.due
        ? parseStoredDate(item.data.due)
        : null;
    if (item.data?.completed) {
      groups.completed.push(item);
      continue;
    }
    if (!due) {
      groups.undated.push(item);
      continue;
    }
    const day = startOfDay(due.date).getTime();
    if (day < today) {
      groups.overdue.push(item);
    } else if (day === today) {
      groups.today.push(item);
    } else {
      const bucket = byDay.get(day);
      if (bucket) {
        bucket.items.push(item);
      } else {
        const bucketItems = [item];
        byDay.set(day, { date: due.date, items: bucketItems });
      }
    }
  }
  const title = (a: TaskItem, b: TaskItem) => a.name.localeCompare(b.name);
  // Decorate-time parse: sorting re-parses nothing per comparison.
  const stamp = (a: TaskItem): number =>
    a.data?.due ? (parseStoredDate(a.data.due)?.date.getTime() ?? 0) : 0;
  const sortable = [...groups.overdue, ...groups.today, ...groups.undated];
  const stamps = new Map(sortable.map((item) => [item.uri, stamp(item)]));
  const byTime = (a: TaskItem, b: TaskItem) =>
    (stamps.get(a.uri) ?? 0) - (stamps.get(b.uri) ?? 0) || title(a, b);
  groups.overdue.sort(byTime);
  groups.today.sort(byTime);
  groups.undated.sort(title);
  groups.completed.sort(title);
  groups.upcoming = [...byDay.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((bucket) => ({ date: bucket.date, items: bucket.items.sort(byTime) }));
  return groups;
}
