import * as React from "react";
import type { BrokenList, TaskItem } from "@/types/task";

/**
 * The store's read side, in two contexts: the row list and the store's
 * metadata. Splitting them keeps a row consumer from re-rendering on a
 * status change, and a status reader from re-rendering on every row.
 */
export type StoreStatus = "loading" | "ready" | "error";

export type StoreMeta = {
  mode: "mock" | "vault";
  status: StoreStatus;
  /** The last failed operation's text, for diagnostics. */
  lastError: string | null;
  tasksDir: string | null;
  rootUri: string | null;
  /** The list notes' names, sorted: the tabs after Main. */
  lists: string[];
  /** Notes in Lists/ that fail validation. Shown, never dropped. */
  brokenLists: BrokenList[];
};

/**
 * A missing provider must fail loudly instead of reading as "no rows"
 * or as a ready store, so both defaults are sentinels compared by
 * identity in the hooks below.
 */
const NO_LIST: TaskItem[] = [];

const NO_META: StoreMeta = {
  mode: "mock",
  status: "loading",
  lastError: null,
  tasksDir: null,
  rootUri: null,
  lists: [],
  brokenLists: [],
};

export const TaskListContext = React.createContext<TaskItem[]>(NO_LIST);

export const StoreMetaContext = React.createContext<StoreMeta>(NO_META);

export function useTaskList(): TaskItem[] {
  const tasks = React.useContext(TaskListContext);
  if (tasks === NO_LIST) {
    throw new Error("useTaskList must run inside TasksProvider");
  }
  return tasks;
}

export function useStoreMeta(): StoreMeta {
  const meta = React.useContext(StoreMetaContext);
  if (meta === NO_META) {
    throw new Error("useStoreMeta must run inside TasksProvider");
  }
  return meta;
}
