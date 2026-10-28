import * as React from "react";
import type { TaskItem } from "@/types/task";
import {
  dayLabel,
  parseStoredDate,
  startOfDay,
  todayIso,
} from "@/utils/dates";
import type { SortMode } from "@/lib/settings";
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
  now: Date,
): TaskItem[] {
  const shown = tasks.filter((task) => !isHiddenOccurrence(task, now));
  if (tab === "Main") {
    return shown;
  }
  return inList(shown, tab);
}

/**
 * A spawned occurrence waits for its day, like Google Tasks. It has a
 * `recurrence previous` link and a due date after today. The planner
 * still shows it, because the planner is the calendar surface.
 */
export function isHiddenOccurrence(task: TaskItem, now: Date): boolean {
  const data = task.data;
  if (data == null || data.completed != null) {
    return false;
  }
  if (data["recurrence previous"] == null) {
    return false;
  }
  const due = data.due ? parseStoredDate(data.due) : null;
  if (due == null) {
    return false;
  }
  return startOfDay(due.date).getTime() > startOfDay(now).getTime();
}

/**
 * The lists tab's dated sections, empty ones dropped: Past, Today, one
 * per upcoming day, then No date. `now` labels the day buckets.
 */
/**
 * Manual order: `order` ascending, tasks without one after. The
 * unplaced ones fall back to the order they were created in, then by
 * name, so a fresh list reads oldest first instead of alphabetical.
 * The same rule the sort sheet's My order picks.
 */
function byManualOrder(a: TaskItem, b: TaskItem): number {
  const left = a.data?.order;
  const right = b.data?.order;
  if (left != null && right != null) {
    return left - right || a.name.localeCompare(b.name);
  }
  if (left != null) return -1;
  if (right != null) return 1;
  const created = (task: TaskItem) => task.data?.created ?? "9999-99-99";
  return (
    created(a).localeCompare(created(b)) || a.name.localeCompare(b.name)
  );
}

export function selectSections(
  visible: TaskItem[],
  now: Date,
  sortMode: SortMode = "due",
): TaskSection[] {
  const groups = groupByDue(visible, now);
  const inOrder = (items: TaskItem[]) =>
    sortMode === "manual" ? [...items].sort(byManualOrder) : items;
  const sections: TaskSection[] = [
    { title: "Past", items: inOrder(groups.overdue), tone: "danger" },
    { title: "Today", items: inOrder(groups.today), tone: "ink" },
    ...groups.upcoming.map((bucket) => ({
      title: dayLabel(bucket.date, now),
      items: inOrder(bucket.items),
      tone: "muted" as const,
    })),
    { title: "No date", items: inOrder(groups.undated), tone: "muted" },
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
  const now = useToday();
  return React.useMemo(
    () => selectTabTasks(tasks, tab, now),
    [tasks, tab, now],
  );
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

export function useTaskSections(
  visible: TaskItem[],
  sortMode: SortMode = "due",
): TaskSection[] {
  const now = useToday();
  return React.useMemo(
    () => selectSections(visible, now, sortMode),
    [visible, now, sortMode],
  );
}
