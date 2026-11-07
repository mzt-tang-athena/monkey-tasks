import { groupByDue } from "@/stores/tasks/selectors";
import type { TaskItem } from "@/types/task";
import type { TaskForm } from "@/lib/settings";
import { isoOf, isSameDay } from "@/utils/dates";
import {
  hasTime,
  inSourceList,
  isDone,
  sortByTimeOfDay,
  sortOpenFirst,
  tasksForDayAll,
  type Source,
} from "@/features/planner/model";

/*
 * The rows a day page shows, as pure functions. The live day, the
 * swipe preview and the month's picked day all read these, so a task
 * sits on the same row in each.
 */

/**
 * One day's tasks in the order the day runs: open tasks before done
 * ones, and inside each group the all-day tasks first and then the
 * timed ones by time of day. A recurring task sorts by its own time of
 * day, so a daily task stored on yesterday at 7:00 PM sits among
 * today's times, not above them.
 */
export function sortDay(tasks: TaskItem[]): TaskItem[] {
  const ordered = sortByTimeOfDay(tasks);
  return [
    ...ordered.filter((task) => !isDone(task)),
    ...ordered.filter((task) => isDone(task)),
  ];
}

/**
 * Every task on the day, completed ones kept and struck until the day
 * rolls. Today lists the notes stored on today: a recurring note stored
 * on an earlier day is overdue, and the overdue group holds it. Any
 * other day also lists the recurrences that fall on it.
 */
export function tasksOnDay(
  tasks: TaskItem[],
  day: Date,
  today: Date,
): TaskItem[] {
  if (isSameDay(day, today)) {
    const iso = isoOf(day);
    return sortDay(
      tasks.filter(
        (task) => task.data?.due != null && task.data.due.slice(0, 10) === iso,
      ),
    );
  }
  return sortDay(tasksForDayAll(tasks, day));
}

/** What a day page lists, from the tasks and the toggles. */
export type DayRows = {
  /** Tasks past due: today only. */
  overdue: TaskItem[];
  /** The day's own tasks. */
  dayTasks: TaskItem[];
  /** The day's tasks that carry a time: the ruler's pins. */
  timed: TaskItem[];
  /** The list pane's tasks, for the source and the form. */
  sectionTasks: TaskItem[];
};

/**
 * The rows for one day. The list pane follows the source: the day's
 * tasks for the due period, or the named list. In the pills form the
 * overdue group folds into the pool, so both forms show the same set.
 */
export function dayRows({
  tasks,
  day,
  today,
  source,
  taskForm,
}: {
  tasks: TaskItem[];
  day: Date;
  today: Date;
  source: Source;
  taskForm: TaskForm;
}): DayRows {
  const overdue = isSameDay(day, today) ? groupByDue(tasks, today).overdue : [];
  const dayTasks = tasksOnDay(tasks, day, today);
  const timed = dayTasks.filter(hasTime);
  const listRows =
    source === "due-period"
      ? dayTasks
      : sortOpenFirst(tasks.filter((task) => inSourceList(task, source)));
  const sectionTasks =
    taskForm === "pills" && source === "due-period"
      ? [...sortOpenFirst(overdue), ...listRows]
      : listRows;
  return { overdue, dayTasks, timed, sectionTasks };
}
