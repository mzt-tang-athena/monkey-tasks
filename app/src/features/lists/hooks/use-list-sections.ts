import * as React from "react";
import type { TaskItem } from "@/types/task";
import type { SortMode } from "@/lib/settings";
import { useStoreMeta, useTaskList } from "@/stores/tasks/task-state";
import { useTabSections, useTabTasks } from "@/stores/tasks/selectors";
import { TODAY_LIST } from "@/lib/list-tabs";
import { buildSections, type ListsSection } from "../lib/list-sections";

/**
 * A note to fix: one that fails validation, or a row whose value the
 * schema read through a fallback. `messages` holds the errors in the
 * first case and the warnings in the second.
 */
export type Repair = {
  name: string;
  uri: string;
  messages: string[];
};

/**
 * What a tab shows: its rows as keyed groups, and the notes that need
 * repair. A note that fails validation never renders as a task row. It
 * shows, with its errors, in the repair notice. A note with a warning
 * keeps its row and also shows in the notice, because its alert still
 * rings.
 */
export function useListSections(tab: string, sortMode: SortMode) {
  const { status, brokenLists } = useStoreMeta();
  const rows = useTaskList();
  const shown = useTabTasks(tab);
  // Needs repair reports what a list tab can show. A deed shows on its
  // day and, later, on the board, and `vault:check` names its warnings.
  const allTasks = React.useMemo(
    () => rows.filter((task) => task.data?.status == null),
    [rows],
  );

  const brokenListRepairs = React.useMemo<Repair[]>(
    () =>
      brokenLists.map((list) => ({
        name: list.name,
        uri: list.uri,
        messages: list.errors,
      })),
    [brokenLists],
  );
  const brokenTasks = React.useMemo<Repair[]>(
    () =>
      allTasks
        .filter((task) => (task.errors?.length ?? 0) > 0)
        .map((task) => ({
          name: task.name,
          uri: task.uri,
          messages: task.errors ?? [],
        })),
    [allTasks],
  );
  const warnedTasks = React.useMemo<Repair[]>(
    () =>
      allTasks
        .filter(
          (task) => task.errors == null && (task.warnings?.length ?? 0) > 0,
        )
        .map((task) => ({
          name: task.name,
          uri: task.uri,
          messages: task.warnings ?? [],
        })),
    [allTasks],
  );
  const repairs = React.useMemo<Repair[]>(
    () => [...brokenListRepairs, ...brokenTasks, ...warnedTasks],
    [brokenListRepairs, brokenTasks, warnedTasks],
  );

  const visible = React.useMemo<TaskItem[]>(
    () => shown.filter((task) => (task.errors?.length ?? 0) === 0),
    [shown],
  );
  // Today is a date view: it keeps its Past and Today groups whatever
  // the sort setting says, and a drag never reorders it.
  const byDate = tab === TODAY_LIST;
  const open = useTabSections(visible, tab, sortMode);
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
    /** The tab's completed rows, sorted by name: what a clear deletes. */
    completed,
    /** The tab has done tasks and no open ones. */
    onlyCompleted: open.length === 0 && completed.length > 0,
    /** Rows can be dragged into a manual order, and Today cannot. */
    draggable: !byDate && sortMode === "manual",
  };
}
