import { taskIsDone } from "@monkey-tasks/schemas";
import { addDays, formatLocal, parseStoredDate, startOfDay } from "../../lib/dates";
import type { TaskItem } from "../tasks/query";
import { occursOn } from "../tasks/recurrence";

/*
 * The planner's pure domain layer: the source vocabulary, the period
 * arithmetic, the day filters, and the due-string builders. Nothing
 * here touches React, the store, or a module-level screen value, so
 * the rules can be tested without mounting the route.
 */

type Mode = "day" | "week" | "month";

/** Where the bottom list's tasks come from. */
type Source = "due-period" | "Focus" | "Main";
const SOURCES: Source[] = ["due-period", "Focus", "Main"];

export type { Mode, Source };
export { SOURCES };

/** The source cycle: due period, then each named list, then back. */
export function cycleSource(
  source: Source,
  setSource: (next: Source) => void,
): () => void {
  return () => {
    const index = SOURCES.indexOf(source);
    setSource(SOURCES[(index + 1) % SOURCES.length]);
  };
}

export function sourceLabel(source: Source, mode: Mode): string {
  if (source === "due-period") {
    return mode === "day"
      ? "Due today"
      : mode === "week"
        ? "Due this week"
        : "Due this month";
  }
  return source;
}

/**
 * Week foot pills: every open task of the chosen source, dated or
 * not - dragging moves a date, it never removes membership.
 */
export function pillsForSource(
  tasks: TaskItem[],
  source: Source,
  weekStart: Date,
): TaskItem[] {
  const startIso = isoOf(weekStart);
  const endIso = isoOf(addDays(weekStart, 6));
  const open = tasks.filter((task) => !isDone(task));
  if (source === "due-period") {
    return sortOpenFirst(
      open.filter(
        (task) =>
          task.data?.due == null ||
          (task.data.due.slice(0, 10) >= startIso &&
            task.data.due.slice(0, 10) <= endIso),
      ),
    );
  }
  return sortOpenFirst(open.filter((task) => inSourceList(task, source)));
}

export function inSourceList(task: TaskItem, list: string): boolean {
  if (list === "Main") {
    return task.data == null || !task.data.lists?.length;
  }
  return task.data?.lists?.includes(`[[${list}]]`) ?? false;
}

/** A task is done exactly per the contracts rule. */
export function isDone(task: TaskItem): boolean {
  return task.data == null ? false : taskIsDone(task.data);
}

/** Whole-day index between two epoch times, DST-proof. */
export function dayIndexBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / 86400000);
}

/**
 * The lazy-follow rule for the period rails. A rail sits anchored to
 * today; when the selected period walks off its end, the rail slides
 * just enough that the selection lands on the edge cell: last when
 * moving forward, first when moving backward.
 */
export function railStartIdx(
  anchorIdx: number,
  selIdx: number,
  count: number,
): number {
  if (selIdx > anchorIdx + count - 1) {
    return selIdx - (count - 1);
  }
  if (selIdx < anchorIdx) {
    return selIdx;
  }
  return anchorIdx;
}

/** Open tasks first, by due time, then completed ones behind them.
    Decorate-time parse: sorting re-parses nothing per comparison. */
export function sortOpenFirst(items: TaskItem[]): TaskItem[] {
  const stamp = (task: TaskItem): number =>
    task.data?.due ? (parseStoredDate(task.data.due)?.date.getTime() ?? 0) : 0;
  const stamped = items.map((task) => ({ task, time: stamp(task) }));
  const byTime = (a: { task: TaskItem; time: number }, b: { task: TaskItem; time: number }) =>
    a.time - b.time || a.task.name.localeCompare(b.task.name);
  return [
    ...stamped
      .filter((entry) => !isDone(entry.task))
      .sort(byTime)
      .map((entry) => entry.task),
    ...stamped
      .filter((entry) => isDone(entry.task))
      .sort(byTime)
      .map((entry) => entry.task),
  ];
}

/** One day's tasks in the order the day runs: all day tasks first, by
    name, then timed ones by time of day. A recurring task sorts by its
    own time of day, so its occurrence lands among the day's times, not
    by the day it is stored on. */
export function sortByTimeOfDay(items: TaskItem[]): TaskItem[] {
  const minutes = (task: TaskItem): number => {
    const due = task.data?.due ? parseStoredDate(task.data.due) : null;
    return due?.hasTime ? due.date.getHours() * 60 + due.date.getMinutes() : -1;
  };
  return items
    .map((task) => ({ task, at: minutes(task) }))
    .sort((a, b) => a.at - b.at || a.task.name.localeCompare(b.task.name))
    .map((entry) => entry.task);
}

/** The open tasks touching the day: due that day, or an occurrence
    their rule puts there. */
export function tasksForDay(tasks: TaskItem[], day: Date): TaskItem[] {
  return tasks.filter((task) => !isDone(task) && occursOn(task, day));
}

/** Every task touching the day, completed ones included. */
export function tasksForDayAll(tasks: TaskItem[], day: Date): TaskItem[] {
  return tasks.filter((task) => occursOn(task, day));
}

export function hasTime(task: TaskItem): boolean {
  return task.data?.due
    ? (parseStoredDate(task.data.due)?.hasTime ?? false)
    : false;
}

export function timeOf(task: TaskItem): string {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  if (!due) {
    return "";
  }
  return formatTime(due.date);
}

export function hourOf(task: TaskItem): number | null {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  return due?.hasTime ? due.date.getHours() : null;
}

export function minuteOf(task: TaskItem): number {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  return due?.date.getMinutes() ?? 0;
}

/**
 * The due string a timeline drop writes: the shown day at the
 * slot's hour, keeping the task's own minute.
 */
export function withTime(
  day: Date,
  hour: number,
  minute = 0,
): string {
  return formatLocal(
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute),
    true,
  );
}

/**
 * The due string an all-day move writes: the target day with the
 * task's previous time of day when it had one.
 */
export function withKeptTime(
  day: Date,
  previous: { date: Date; hasTime: boolean } | null,
): string {
  if (!previous?.hasTime) {
    return formatLocal(day, false);
  }
  return formatLocal(
    new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      previous.date.getHours(),
      previous.date.getMinutes(),
    ),
    true,
  );
}

export function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${h}:${String(date.getMinutes()).padStart(2, "0")} ${ampm}`;
}

export function isoOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Sunday of the week holding date. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

/** The first of the month holding date. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/*
 * The URL contract: the route names a mode and a day, so a link can
 * open the planner on any period. Params arrive as strings, or as a
 * string array when the key repeats, so both shapes are accepted.
 */

/** The mode a URL param names; absence and unknown values mean day. */
export function parseMode(value: string | string[] | undefined): Mode {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "week" || raw === "month" ? raw : "day";
}

/** The day a URL param names: local midnight, or the start of today
    when it does not name a real date (2026-02-30 rolls, so it falls
    back rather than filing the screen under the wrong month). */
export function parsePlannerDay(
  value: string | string[] | undefined,
  today: Date,
): Date {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw == null ? null : parseStoredDate(raw);
  return parsed != null && !parsed.hasTime ? parsed.date : startOfDay(today);
}

/** The day param a route writes: the plain calendar date. */
export function plannerDayParam(day: Date): string {
  return isoOf(day);
}

/** The ISO week number of the week holding date. */
export function isoWeek(date: Date): number {
  const probe = startOfDay(date);
  probe.setDate(probe.getDate() + 3 - ((probe.getDay() + 6) % 7));
  const firstThu = new Date(probe.getFullYear(), 0, 4);
  firstThu.setDate(firstThu.getDate() - ((firstThu.getDay() + 6) % 7));
  return (
    1 +
    Math.round((probe.getTime() - firstThu.getTime()) / (7 * 86400000))
  );
}
