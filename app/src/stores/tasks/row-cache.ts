import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import type { BrokenList, ListItem, TaskItem } from "@/types/task";

/**
 * The rows the open tab showed last session, so a cold start draws them
 * at once while the vault read runs (ADR `20261126-a-cached-first-frame`).
 * The rows live in app storage, never in the vault, so no note and no
 * schema changes. `root` and `tasksDir` date the rows: a different
 * grant or a moved Tasks folder drops them.
 */
export type CachedRows = {
  version: number;
  /** The granted folder the rows came from. */
  root: string;
  /** The Tasks folder inside that grant. */
  tasksDir: string | null;
  /** The tab these rows belong to. Only the open tab is kept. */
  tab: string;
  tasks: TaskItem[];
  lists: ListItem[];
  brokenLists: BrokenList[];
};

const FILE_NAME = "monkey-tasks-rows.json";

/** The format's version. A cache from another version is dropped. */
const VERSION = 1;

/**
 * The most rows kept. The open tab holds what it shows, and a cap keeps
 * a very large tab from writing a file that costs more to read than the
 * rows save.
 */
export const MAX_CACHED_ROWS = 200;

function cacheFile(): File {
  return new File(Paths.document, FILE_NAME);
}

function isTask(value: unknown): value is TaskItem {
  const row = value as TaskItem | null;
  return (
    row != null &&
    typeof row.uri === "string" &&
    typeof row.name === "string" &&
    typeof row.fileName === "string"
  );
}

/** Read the file text as rows, or null when it is not this version. */
export function parseCachedRows(text: string): CachedRows | null {
  try {
    const value = JSON.parse(text) as Partial<CachedRows> | null;
    if (
      value == null ||
      value.version !== VERSION ||
      typeof value.root !== "string" ||
      typeof value.tab !== "string" ||
      !Array.isArray(value.tasks) ||
      !value.tasks.every(isTask)
    ) {
      return null;
    }
    return {
      version: VERSION,
      root: value.root,
      tasksDir: typeof value.tasksDir === "string" ? value.tasksDir : null,
      tab: value.tab,
      tasks: value.tasks.slice(0, MAX_CACHED_ROWS),
      lists: Array.isArray(value.lists)
        ? (value.lists as ListItem[]).filter(
            (item) => item != null && typeof item.name === "string",
          )
        : [],
      brokenLists: Array.isArray(value.brokenLists)
        ? (value.brokenLists as BrokenList[])
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * The rows saved last session, or null. The web preview has no app
 * files, and reads its memory vault at once, so it keeps no cache.
 */
export function readCachedRows(): CachedRows | null {
  if (Platform.OS === "web") {
    return null;
  }
  try {
    const file = cacheFile();
    return file.exists ? parseCachedRows(file.textSync()) : null;
  } catch {
    return null;
  }
}

/** Keep these rows for the next cold start. A failure only loses them. */
export function writeCachedRows(
  rows: Omit<CachedRows, "version" | "tasks"> & { tasks: TaskItem[] },
): void {
  if (Platform.OS === "web") {
    return;
  }
  try {
    cacheFile().writeSync(
      JSON.stringify({
        ...rows,
        version: VERSION,
        tasks: rows.tasks.slice(0, MAX_CACHED_ROWS),
      }),
    );
  } catch {
    // The next cold start draws the skeleton instead. Nothing else breaks.
  }
}

export function clearCachedRows(): void {
  if (Platform.OS === "web") {
    return;
  }
  try {
    const file = cacheFile();
    if (file.exists) {
      file.delete();
    }
  } catch {
    // A cache that cannot be deleted is replaced by the next write.
  }
}
