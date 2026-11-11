import * as React from "react";
import type { TaskItem } from "@/types/task";
import { occurrencesBetween } from "@/lib/recurrence";
import { sortDay } from "@/features/planner/lib/day-rows";
import {
  inSourceList,
  sortOpenFirst,
  startOfMonth,
  tasksForDay,
  type Source,
} from "@/features/planner/model";

/** What the month pane reads: the tasks, the source filter, and the
    route day the strip and card follow. */
type PlannerMonthOptions = {
  tasks: TaskItem[];
  source: Source;
  day: Date;
};

/**
 * The planner's month state: the month
 * the strip shows, the picked day, and the rows the pane lists.
 */
export function usePlannerMonth({ tasks, source, day }: PlannerMonthOptions) {
  // The month card's picked day carries the month key it belongs to,
  // so a new month from the strip invalidates the pick without an
  // effect.
  const [picked, setPicked] = React.useState<{
    key: string;
    day: Date;
  } | null>(null);
  const viewMonth = React.useMemo(() => startOfMonth(day), [day]);
  const monthKey = `${viewMonth.getFullYear()}-${viewMonth.getMonth()}`;
  const pickedDay =
    picked != null && picked.key === monthKey ? picked.day : null;

  // The month pane follows the source until a day is picked; then it
  // lists that day's tasks, with the day as its header and the
  // day-view link as its footer. A task belongs to the month when it
  // has an occurrence there, so a recurring task stored in an earlier
  // month lists here as well as dotting the grid.
  const monthYear = viewMonth.getFullYear();
  const monthIndex = viewMonth.getMonth();
  const monthRows = React.useMemo(() => {
    const first = new Date(monthYear, monthIndex, 1);
    const last = new Date(monthYear, monthIndex + 1, 0);
    return sortOpenFirst(
      tasks.filter(
        (task) =>
          (source === "due-period" || inSourceList(task, source)) &&
          occurrencesBetween(task, first, last).length > 0,
      ),
    );
  }, [tasks, source, monthYear, monthIndex]);
  const pickedTasks = React.useMemo(
    () => (pickedDay == null ? [] : sortDay(tasksForDay(tasks, pickedDay))),
    [tasks, pickedDay],
  );

  return {
    picked,
    setPicked,
    viewMonth,
    monthKey,
    pickedDay,
    monthRows,
    pickedTasks,
  };
}

/** What `usePlannerMonth` returns: the month pane's state. */
export type PlannerMonth = ReturnType<typeof usePlannerMonth>;
