import * as React from "react";
import type { PointerEvent as RNPointerEvent } from "react-native";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "../../tasks/query";
import { DropZoneMap } from "../../../lib/dropzone";
import { addDays, isSameDay, parseStoredDate } from "../../../lib/dates";
import { drag } from "../../../theme/tokens";
import { withKeptTime } from "../model";
import type { DragApi, LiftState } from "../components/drag";
import { useTouchDragGate, type PendingDrag } from "./useTouchDragGate";

/** What the gesture layer needs from the screen: the route day it
    shifts, the store writes it runs, and the platform pickup mode. */
type PlannerGesturesOptions = {
  day: Date;
  setDay: (next: Date) => void;
  toggle: (task: TaskItem) => void;
  writeFields: (task: TaskItem, patch: Partial<TaskFrontmatter>) => void;
  pointerPickup: boolean;
};

/** One drag in flight: the task and the page point under the finger. */
type DragState = { task: TaskItem; x: number; y: number };

/** The root View's pointer wiring: whole on web, reset-only on native. */
type PointerHandlers = { onPointerDown: () => void; onPointerMove?: (e: RNPointerEvent) => void; onPointerUp?: () => void; onPointerCancel?: () => void };

/* Pointer modules: the drag closures below are created during render
   but only ever run on pointer events, so the react-hooks/refs rule
   cannot see their safety; ref writes outside them are mirrored. */

/**
 * The planner's gesture layer: the hold-then-drag pickup, the shared
 * drop-zone hit-test, the drop write, the click guards a drop leaves
 * behind, and the day and month shifts the swipes run.
 */
export function usePlannerGestures({
  day,
  setDay,
  toggle: storeToggle,
  writeFields,
  pointerPickup,
}: PlannerGesturesOptions) {
  // The pill/list drag that targets week columns and month cells.
  const [pending, setPending] = React.useState<PendingDrag | null>(null);
  const [dragging, setDragging] = React.useState<DragState | null>(null);
  const [hoveredDay, setHoveredDay] = React.useState<Date | null>(null);
  const moved = React.useRef(false);

  // The shared drop-zone registry: week columns and month cells
  // register their rects; pointer moves hit-test page coordinates.
  const [dropZones] = React.useState(() => new DropZoneMap());

  // The screen root carries the scroll gate: when a drag owns the
  // pointer, pane scrolling loses the gesture; touch promotions are
  // the gate's because touchmove outraces pointermove.
  const rootRef = React.useRef<HTMLElement | null>(null);
  const gateRef = React.useRef(false);
  const pendingRef = React.useRef(pending);
  React.useEffect(() => { pendingRef.current = pending; }, [pending]);
  React.useEffect(() => { gateRef.current = dragging != null; }, [dragging]);

  const promotePending = React.useCallback((x: number, y: number) => {
    const pending = pendingRef.current;
    if (!pending || pending.task == null) return;
    moved.current = true;
    dropZones.measureAll();
    setDragging({ task: pending.task, x, y });
    setPending(null);
  }, [dropZones]);
  const lifted = React.useMemo<LiftState>(
    () =>
      pending != null
        ? { task: pending.task, phase: "hold" }
        : dragging != null
          ? { task: dragging.task, phase: "picked" }
          : null,
    [pending, dragging],
  );
  useTouchDragGate(rootRef, {
    busy: gateRef,
    pending: pendingRef,
    promote: promotePending,
  });

  // Native drag sources drive the same machinery through here.
  const dragApi = React.useMemo<DragApi>(() => {
    const apply = () => {
      const current = draggingRef.current;
      if (current && hoveredRef.current != null) {
        updateTaskRef.current?.(current.task, {
          due: withKeptTime(
            hoveredRef.current,
            parseStoredDate(current.task.data?.due ?? ""),
          ),
        });
      }
      // Only a pointer gesture delivers a click after the drop, so
      // only the web path arms the guard. Native taps must land.
      if (pointerPickup) {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 350);
      }
      setDragging(null);
      setHoveredDay(null);
    };
    return {
      pickup: (task, x, y) => {
        moved.current = false;
        dropZones.measureAll();
        setDragging({ task, x, y });
      },
      move: (x, y) => {
        setDragging((current) => (current ? { ...current, x, y } : current));
        const hit = dropZones.hit(x, y);
        const dayTarget = hit?.startsWith("day:") ? (parseStoredDate(hit.slice(4))?.date ?? null) : null;
        if (!isSameDay(dayTarget, hoveredRef.current)) {
          // The ref leads the state: a drop reads it before React
          // commits the render that carries the new hover.
          hoveredRef.current = dayTarget;
          setHoveredDay(dayTarget);
        }
      },
      drop: apply,
    };
  }, [dropZones, pointerPickup]);
  const draggingRef = React.useRef(dragging);
  const hoveredRef = React.useRef(hoveredDay);
  React.useEffect(() => { draggingRef.current = dragging; }, [dragging]);
  React.useEffect(() => { hoveredRef.current = hoveredDay; }, [hoveredDay]);
  const updateTaskRef = React.useRef<(task: TaskItem, patch: Partial<TaskFrontmatter>) => void>(null);

  const toggle = React.useCallback((task: TaskItem) => {
    void storeToggle(task);
  }, [storeToggle]);

  // Drag-and-drop writes due dates and times through here: the store
  // applies locally, then rewrites the note in vault mode. The
  // callback keeps its identity for the store's lifetime: dayApi is
  // keyed on it, and a fresh identity every render would rebuild the
  // native pan on every move.
  const updateTask = React.useCallback((task: TaskItem, patch: Partial<TaskFrontmatter>) => {
    void writeFields(task, patch);
  }, [writeFields]);
  React.useEffect(() => { updateTaskRef.current = updateTask; }, [updateTask]);

  // Suppress press actions that follow a drag drop: the pointer-up
  // lands inside a pressable that would otherwise act on it.
  const suppressClick = React.useRef(false);
  const guardedToggle = (task: TaskItem) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    toggle(task);
  };
  // Week columns select a day; a drop from a dragged task must not
  // select the column it was released over.
  const guardedSelect = (next: Date) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setDay(next);
  };

  // Left/right swipe on the background shifts the day in the route.
  // DaySpread and MonthView build their swipe controllers once on
  // mount, so the shift reads the current day through a ref.
  const dayRef = React.useRef(day);
  React.useEffect(() => { dayRef.current = day; }, [day]);
  const shiftDay = (delta: 1 | -1) => setDay(addDays(dayRef.current, delta));
  const shiftMonth = (delta: 1 | -1) => {
    const current = dayRef.current;
    setDay(new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const startDayDrag = (task: TaskItem, e: RNPointerEvent, kind: "pill" | "row" = "row") => {
    moved.current = false;
    setPending({
      task,
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
      t: performance.now(),
      touch: (e.nativeEvent as { pointerType?: string }).pointerType === "touch",
      kind,
    });
  };

  const onPointerMove = (e: RNPointerEvent) => {
    const x = e.nativeEvent.pageX;
    const y = e.nativeEvent.pageY;
    if (pending) {
      const travel = Math.abs(x - pending.x) + Math.abs(y - pending.y);
      if (pending.touch) {
        // Touch grammar: movement while still holding is a scroll.
        // Movement AFTER the hold completed is a drag, however far
        // it jumps between move events. Pills hold for less: their
        // section has free space to scroll from without touching
        // them.
        const hold = pending.kind === "pill" ? drag.pillPickMs : drag.pickMs;
        if (performance.now() - pending.t < hold) {
          if (travel > drag.threshold) { setPending(null); return; }
          return;
        }
      } else if (travel <= drag.threshold) {
        return;
      }
      moved.current = true;
      dropZones.measureAll();
      setDragging({ task: pending.task, x, y });
      setPending(null);
      return;
    }
    if (dragging) {
      setDragging({ ...dragging, x, y });
      // Hit-test against the drop zones: enter/leave do not fire on touch.
      const hit = dropZones.hit(x, y);
      const dayTarget = hit?.startsWith("day:") ? (parseStoredDate(hit.slice(4))?.date ?? null) : null;
      if (!isSameDay(dayTarget, hoveredDay)) setHoveredDay(dayTarget);
    }
  };

  const onPointerUp = () => {
    if (dragging) {
      if (hoveredDay != null) {
        // A day move keeps the task's own time of day, per the
        // approved rule: reschedule the date, never the clock.
        updateTask(dragging.task, {
          due: withKeptTime(hoveredDay, parseStoredDate(dragging.task.data?.due ?? "")),
        });
      }
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 350);
      setDragging(null);
      setHoveredDay(null);
    }
    setPending(null);
    moved.current = false;
  };

  const onPointerDownScreen = () => {
    // A fresh gesture clears drag-end suppression; the 350ms timer
    // stays as the fallback for engines that skip pointerdown.
    suppressClick.current = false;
  };

  const pointerHandlers: PointerHandlers = pointerPickup
    ? { onPointerDown: onPointerDownScreen, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
    : { onPointerDown: onPointerDownScreen };

  return {
    rootRef, dragging, hoveredDay, dropZones, lifted, dragApi, toggle,
    updateTask, guardedToggle, guardedSelect, suppressClick, shiftDay,
    shiftMonth, startDayDrag, pointerHandlers,
  };
}
