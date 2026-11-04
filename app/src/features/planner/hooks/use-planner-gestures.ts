import * as React from "react";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import { DropZoneMap } from "@/features/planner/lib/dropzone";
import { addDays, parseStoredDate } from "@/utils/dates";
import { minuteOf, withKeptTime, withTime } from "@/features/planner/model";
import { useDragSession, type DragPatch } from "./use-drag-session";

/** What the gesture layer needs from the screen: the route day it
    shifts, the store writes it runs, and the platform pickup mode. */
type PlannerGesturesOptions = {
  day: Date;
  setDay: (next: Date) => void;
  toggle: (task: TaskItem) => void;
  open: (task: TaskItem) => void;
  writeFields: (task: TaskItem, patch: Partial<TaskFrontmatter>) => void;
  pointerPickup: boolean;
};

/**
 * The planner's gesture layer. Drag runs in `useDragSession` for all
 * three modes: this hook says what a drop zone means, and guards the
 * presses a drop leaves behind. It also holds the day and month shifts
 * the swipes run. Every callback it returns keeps its identity.
 */
export function usePlannerGestures({
  day,
  setDay,
  toggle: storeToggle,
  open: storeOpen,
  writeFields,
  pointerPickup,
}: PlannerGesturesOptions) {
  // Week columns and month cells register as "day:<iso>", the ruler's
  // rows as "hour:<n>", all in one map.
  const [zones] = React.useState(() => new DropZoneMap());

  // A day move keeps the task's own time of day: it reschedules the
  // date, never the clock. An hour drop writes the shown day at the
  // slot's hour, keeping the task's own minute.
  const resolve = React.useCallback(
    (hit: string, task: TaskItem): DragPatch | null => {
      if (hit.startsWith("day:")) {
        const target = parseStoredDate(hit.slice(4))?.date;
        return target == null
          ? null
          : { due: withKeptTime(target, parseStoredDate(task.data?.due ?? "")) };
      }
      if (hit.startsWith("hour:")) {
        return { due: withTime(day, Number(hit.slice(5)), minuteOf(task)) };
      }
      return null;
    },
    [day],
  );
  const write = React.useCallback(
    (task: TaskItem, patch: DragPatch) => {
      void writeFields(task, patch);
    },
    [writeFields],
  );
  const session = useDragSession({ zones, resolve, write, pointerPickup });
  const { consumeClick } = session;

  // A drop's leftover click must not tick, open or select what lies
  // under the finger.
  const toggle = React.useCallback(
    (task: TaskItem) => {
      if (!consumeClick()) {
        void storeToggle(task);
      }
    },
    [consumeClick, storeToggle],
  );
  const open = React.useCallback(
    (task: TaskItem) => {
      if (!consumeClick()) {
        storeOpen(task);
      }
    },
    [consumeClick, storeOpen],
  );
  const select = React.useCallback(
    (next: Date) => {
      if (!consumeClick()) {
        setDay(next);
      }
    },
    [consumeClick, setDay],
  );

  // A swipe on the background shifts the day in the route. The day
  // body and the month card build their swipe controllers once, so
  // the shift reads the current day through a ref.
  const dayRef = React.useRef(day);
  React.useEffect(() => {
    dayRef.current = day;
  }, [day]);
  const shiftDay = React.useCallback(
    (delta: 1 | -1) => setDay(addDays(dayRef.current, delta)),
    [setDay],
  );
  const shiftMonth = React.useCallback(
    (delta: 1 | -1) => {
      const current = dayRef.current;
      setDay(new Date(current.getFullYear(), current.getMonth() + delta, 1));
    },
    [setDay],
  );

  return { ...session, toggle, open, select, shiftDay, shiftMonth };
}
