import * as React from "react";
import { groupByDue, inList, type TaskItem } from "../features/tasks/query";
import { dayLabel, parseStoredDate, todayIso } from "../lib/dates";
import { useStoreMeta, useTaskList } from "./task-state";

/*
 * The pure layer over the store's rows: the planner's open pool, the
 * lists tab's views, and the dated sections they render. Each selector
 * takes its `now` so tests pin the day; the hooks below feed them the
 * current day and memoise the result.
 */

/** The tone a section header takes: failures, plain, and quiet. */
export type SectionTone = "danger" | "ink" | "muted";

export type TaskSection = {
  title: string;
  items: TaskItem[];
  tone: SectionTone;
};

/**
 * A tab name: Main, or the name of a list note in Tasks/Lists/. Any
 * other string is a list tab.
 */
export type ListTab = string;

/**
 * Every open task in one row: overdue, today, undated, then each
 * upcoming day in order. This is the planner's pill pool, so a drag
 * sees the same set the rail does.
 */
export function selectOpenTasks(tasks: TaskItem[], now: Date): TaskItem[] {
  const groups = groupByDue(tasks, now);
  const open = [...groups.overdue, ...groups.today, ...groups.undated];
  for (const bucket of groups.upcoming) {
    open.push(...bucket.items);
  }
  return open;
}

/**
 * Main is the catch-all: every task, whatever list it carries. Any
 * other tab is a list note, so it shows the tasks whose lists property
 * carries [[that name]]. Focus is a list note like the rest. See ADR
 * 0015 and its 2026-10-24 amendment.
 */
export function selectTabTasks(
  tasks: TaskItem[],
  tab: ListTab,
): TaskItem[] {
  if (tab === "Main") {
    return tasks;
  }
  return inList(tasks, tab);
}

/**
 * The lists tab's dated sections, empty ones dropped: Past, Today, one
 * per upcoming day, then No date. `now` labels the day buckets.
 */
export function selectSections(
  visible: TaskItem[],
  now: Date,
): TaskSection[] {
  const groups = groupByDue(visible, now);
  const sections: TaskSection[] = [
    { title: "Past", items: groups.overdue, tone: "danger" },
    { title: "Today", items: groups.today, tone: "ink" },
    ...groups.upcoming.map((bucket) => ({
      title: dayLabel(bucket.date, now),
      items: bucket.items,
      tone: "muted" as const,
    })),
    { title: "No date", items: groups.undated, tone: "muted" },
  ];
  return sections.filter((section) => section.items.length > 0);
}

/**
 * The current day, held until the date rolls: the selectors only read
 * day boundaries out of `now`, so a midnight stamp is as good as the
 * render's clock and keeps the memos below stable across renders.
 */
function useToday(): Date {
  const day = todayIso();
  return React.useMemo(
    () => parseStoredDate(day)?.date ?? new Date(),
    [day],
  );
}

export function useOpenTasks(): TaskItem[] {
  const tasks = useTaskList();
  const now = useToday();
  return React.useMemo(() => selectOpenTasks(tasks, now), [tasks, now]);
}

export function useTabTasks(tab: ListTab): TaskItem[] {
  const tasks = useTaskList();
  return React.useMemo(() => selectTabTasks(tasks, tab), [tasks, tab]);
}

/**
 * The tab bar's order: Main first, then every list note by name. Main
 * is the only fixed tab, so a list note named Focus or Main cannot make
 * a second tab.
 */
export function useListTabs(): string[] {
  const { lists } = useStoreMeta();
  return React.useMemo(() => {
    const tabs = ["Main"];
    for (const name of lists) {
      if (!tabs.includes(name)) {
        tabs.push(name);
      }
    }
    return tabs;
  }, [lists]);
}

export function useTaskSections(visible: TaskItem[]): TaskSection[] {
  const now = useToday();
  return React.useMemo(() => selectSections(visible, now), [visible, now]);
}
