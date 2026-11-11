import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { createDragSurface } from "@/components/motion/drag-surface";
import type { TaskItem } from "@/types/task";
import { parseStoredDate } from "@/utils/dates";
import { minuteOf, withKeptTime, withTime } from "../model";

/**
 * What a planner drop lands on: an hour row on the day being shown, or
 * a calendar day. The target is data, so a zone carries it and the drop
 * handler turns it into a write.
 */
export type PlanTarget = { kind: "hour"; hour: number } | { kind: "day"; iso: string };

export type DragPatch = Partial<TaskFrontmatter>;

/** The planner's one drag surface: rows, pills and hour tasks to hour
    rows, week columns and month cells. */
export const PlanDrag = createDragSurface<TaskItem, PlanTarget>();

/**
 * The write a drop makes. An hour target sets that hour on the route
 * day and keeps the task's minute. A day target sets that date and
 * keeps the task's time of day. Neither moves a task that the target
 * cannot place: a day that is not a date writes nothing.
 */
export function patchForDrop(
  task: TaskItem,
  target: PlanTarget,
  routeDay: Date,
): DragPatch {
  if (target.kind === "hour") {
    return { due: withTime(routeDay, target.hour, minuteOf(task)) };
  }
  const day = parseStoredDate(target.iso)?.date;
  if (day == null) {
    return {};
  }
  const previous = task.data?.due ? parseStoredDate(task.data.due) : null;
  return { due: withKeptTime(day, previous) };
}
