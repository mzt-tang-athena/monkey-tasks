import * as React from "react";
import type { TaskItem } from "../../tasks/query";
import {
  inSourceList,
  isDone,
  isoOf,
  pillsForSource,
  sortOpenFirst,
  startOfMonth,
  startOfWeek,
  type Source,
} from "../model";

/** What the month pane reads: the tasks, the source filter, and the
    route day the strip and card follow. */
type PlannerMonthOptions = {
  tasks: TaskItem[];
  source: Source;
  day: Date;
};

/**
 * The planner's month state: the week's placement pool, the month
 * the strip shows, the picked day, and the rows the pane lists.
 */
export function usePlannerMonth({ tasks, source, day }: PlannerMonthOptions) {
  const weekPool = pillsForSource(tasks, source, startOfWeek(day));

  // The month card's picked day carries the month key it belongs to,
  // so a new month from the strip invalidates the pick without an
  // effect.
  const [picked, setPicked] = React.useState<{
    key: string;
    day: Date;
  } | null>(null);
  const viewMonth = startOfMonth(day);
  const monthKey = `${viewMonth.getFullYear()}-${viewMonth.getMonth()}`;
  const pickedDay =
    picked != null && picked.key === monthKey ? picked.day : null;

  // The month pane follows the source until a day is picked; then it
  // lists that day's tasks, with the day as its header and the
  // day-view link as its footer.
  const monthPrefix = `${viewMonth.getFullYear()}-${String(
    viewMonth.getMonth() + 1,
  ).padStart(2, "0")}`;
  const monthRows = React.useMemo(
    () =>
      source === "due-period"
        ? sortOpenFirst(
            tasks.filter(
              (task) =>
                task.data?.due != null &&
                task.data.due.slice(0, 7) === monthPrefix,
            ),
          )
        : sortOpenFirst(tasks.filter((task) => inSourceList(task, source))),
    [tasks, source, monthPrefix],
  );
  const pickedTasks = React.useMemo(
    () =>
      pickedDay == null
        ? []
        : tasks.filter(
            (task) =>
              task.data?.due != null &&
              !isDone(task) &&
              task.data.due.slice(0, 10) === isoOf(pickedDay),
          ),
    [tasks, pickedDay],
  );

  return {
    weekPool,
    picked,
    setPicked,
    viewMonth,
    monthKey,
    pickedDay,
    monthPrefix,
    monthRows,
    pickedTasks,
  };
}
