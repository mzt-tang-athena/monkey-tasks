import * as React from "react";
import type { TaskItem } from "@/types/task";
import {
  dayLabel,
  parseStoredDate,
  startOfDay,
  todayIso,
} from "@/utils/dates";
import { occursOn } from "@/lib/recurrence";
import { listTabs, MAIN_LIST, TODAY_LIST, type BuiltinTabs } from "@/lib/list-tabs";
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
  /** The header's label, or null for a group with no header. */
  title: string | null;
  items: TaskItem[];
  tone: SectionTone;
};

/**
 * A tab name: Main, the built-in Today list, or the name of a list note
 * in Tasks/Lists/. Any other string is a list tab.
 */
export type ListTab = string;

export function inList(items: TaskItem[], listName: string): TaskItem[] {
  const link = `[[${listName}]]`;
  return items.filter((item) => item.data?.list === link);
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
  groups.overdue = sortByDueTime(groups.overdue);
  groups.today = sortByDueTime(groups.today);
  groups.undated.sort(title);
  groups.completed.sort(title);
  groups.upcoming = [...byDay.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((bucket) => ({
      date: bucket.date,
      items: sortByDueTime(bucket.items),
    }));
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
 * Main holds the unfiled tasks: those with no list. Any other tab is a
 * list note, so it shows the tasks whose list property carries
 * [[that name]]. Focus is a list note like the rest. See ADR
 * 20261111-one-list-and-tab-order and the 2026-11-11 amendment to ADR
 * 0015.
 *
 * Today is the built-in day view. It takes the tasks the planner's day
 * rule puts on today, plus the overdue ones, and a tick leaves it. See
 * ADR 20261125-today-list.
 *
 * A task with a status is a deed, and a deed is never a list row. Main
 * would otherwise hold every deed, because none of them carries a
 * list. The board shows deeds (ADR `20261124-deeds-are-tasks-with-a-status`).
 */
export function selectTabTasks(
  tasks: TaskItem[],
  tab: ListTab,
  now: Date,
): TaskItem[] {
  const shown = tasks.filter(
    (task) => task.data?.status == null && !isHiddenOccurrence(task, now),
  );
  if (tab === MAIN_LIST) {
    return shown.filter((task) => !task.data?.list);
  }
  if (tab === TODAY_LIST) {
    return selectTodayTasks(shown, now);
  }
  return inList(shown, tab);
}

/**
 * Today's rows, in two groups: the tasks the day rule puts on today,
 * and the overdue ones. An occurrence today wins over the stored due
 * day, so a daily task stored last week reads under Today. A done task
 * never shows, so a tick leaves the tab. A reminder alone does not
 * count; the due date decides.
 */
export function selectTodayGroups(
  items: TaskItem[],
  now: Date,
): { past: TaskItem[]; today: TaskItem[] } {
  const start = startOfDay(now).getTime();
  const past: TaskItem[] = [];
  const today: TaskItem[] = [];
  for (const item of items) {
    if (item.data?.completed != null) {
      continue;
    }
    if (occursOn(item, now)) {
      today.push(item);
      continue;
    }
    const due = item.data?.due ? parseStoredDate(item.data.due) : null;
    if (due != null && startOfDay(due.date).getTime() < start) {
      past.push(item);
    }
  }
  return { past: sortByDueTime(past), today: sortByDueTime(today) };
}

/** Today's rows in reading order: the past group, then today's. */
export function selectTodayTasks(items: TaskItem[], now: Date): TaskItem[] {
  const groups = selectTodayGroups(items, now);
  return [...groups.past, ...groups.today];
}

/** Today's sections: the past group above today's, empty ones dropped. */
export function selectTodaySections(
  visible: TaskItem[],
  now: Date,
): TaskSection[] {
  const groups = selectTodayGroups(visible, now);
  return [
    { title: "Past", items: groups.past, tone: "danger" as const },
    { title: "Today", items: groups.today, tone: "ink" as const },
  ].filter((section) => section.items.length > 0);
}

/** Due time ascending, ties by title. */
function sortByDueTime(items: TaskItem[]): TaskItem[] {
  const stamp = (item: TaskItem): number =>
    item.data?.due ? (parseStoredDate(item.data.due)?.date.getTime() ?? 0) : 0;
  const stamps = new Map(items.map((item) => [item.uri, stamp(item)]));
  return [...items].sort(
    (a, b) =>
      (stamps.get(a.uri) ?? 0) - (stamps.get(b.uri) ?? 0) ||
      a.name.localeCompare(b.name),
  );
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

const created = (task: TaskItem): string =>
  task.data?.created ?? "9999-99-99";

/** The fallback order: the note's `created`, then its name. */
const byCreated = (a: TaskItem, b: TaskItem): number =>
  created(a).localeCompare(created(b)) || a.name.localeCompare(b.name);

/**
 * Manual order: `order` ascending over the whole tab, tasks without
 * one after. Equal orders break by `created`, then by name, so the
 * duplicates old section-level drags left read in a stable order. The
 * unplaced ones use the same fallback, so a fresh list reads oldest
 * first instead of alphabetical. See ADR
 * 20261111-one-list-and-tab-order.
 */
function byManualOrder(a: TaskItem, b: TaskItem): number {
  const left = a.data?.order;
  const right = b.data?.order;
  if (left != null && right != null) {
    return left - right || byCreated(a, b);
  }
  if (left != null) return -1;
  if (right != null) return 1;
  return byCreated(a, b);
}

/**
 * The lists tab's sections. Due order keeps the dated groups, empty
 * ones dropped: Past, Today, one per upcoming day, then No date. My
 * order returns one headerless group of every open row, sorted by the
 * whole-tab `order`; the screen builds Completed separately.
 */
export function selectSections(
  visible: TaskItem[],
  now: Date,
  sortMode: SortMode = "due",
): TaskSection[] {
  if (sortMode === "manual") {
    const open = visible.filter((item) => item.data?.completed == null);
    if (open.length === 0) {
      return [];
    }
    return [{ title: null, items: [...open].sort(byManualOrder), tone: "ink" }];
  }
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
  const now = useToday();
  return React.useMemo(
    () => selectTabTasks(tasks, tab, now),
    [tasks, tab, now],
  );
}

/**
 * The tab bar's order as a hook: the pure rule lives in `lib/list-tabs`,
 * so the command pane and the strip cannot drift.
 */
export function useListTabs(builtins: BuiltinTabs): string[] {
  const { lists } = useStoreMeta();
  return React.useMemo(() => listTabs(lists, builtins), [lists, builtins]);
}

export function useTabSections(
  visible: TaskItem[],
  tab: ListTab,
  sortMode: SortMode = "due",
): TaskSection[] {
  const now = useToday();
  return React.useMemo(
    () =>
      tab === TODAY_LIST
        ? selectTodaySections(visible, now)
        : selectSections(visible, now, sortMode),
    [visible, tab, sortMode, now],
  );
}
