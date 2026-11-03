import * as React from "react";
import type { BrokenList, TaskItem } from "@/types/task";
import type { SortMode } from "@/lib/settings";
import { useStoreMeta, useTaskList } from "@/stores/tasks/task-state";
import { useTabTasks, useTaskSections } from "@/stores/tasks/selectors";
import { buildSections, type ListsSection } from "../lib/list-sections";

/** A note that failed validation, with the reasons. */
export type Repair = Pick<BrokenList, "name" | "uri" | "errors">;

/**
 * What a tab shows: its rows as keyed groups, and the notes that need
 * repair. A note that fails validation never renders as a task row. It
 * shows, with its errors, in the repair notice.
 */
export function useListSections(tab: string, sortMode: SortMode) {
  const { status, brokenLists } = useStoreMeta();
  const allTasks = useTaskList();
  const shown = useTabTasks(tab);

  const brokenTasks = React.useMemo<Repair[]>(
    () =>
      allTasks
        .filter((task) => (task.errors?.length ?? 0) > 0)
        .map((task) => ({
          name: task.name,
          uri: task.uri,
          errors: task.errors ?? [],
        })),
    [allTasks],
  );
  const repairs = React.useMemo<Repair[]>(
    () => [...brokenLists, ...brokenTasks],
    [brokenLists, brokenTasks],
  );

  const visible = React.useMemo<TaskItem[]>(
    () => shown.filter((task) => (task.errors?.length ?? 0) === 0),
    [shown],
  );
  const open = useTaskSections(visible, sortMode);
  const completed = React.useMemo(
    () =>
      visible
        .filter((task) => task.data?.completed)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [visible],
  );
  const sections = React.useMemo<ListsSection[]>(
    () => (status === "ready" ? buildSections(open, completed) : []),
    [status, open, completed],
  );

  return {
    /** The tab's rows, with their latest data. */
    shown,
    repairs,
    sections,
    /** The tab has done tasks and no open ones. */
    onlyCompleted: open.length === 0 && completed.length > 0,
  };
}
