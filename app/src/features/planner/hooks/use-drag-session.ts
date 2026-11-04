import * as React from "react";
import {
  Animated,
  type PointerEvent as RNPointerEvent,
  type View,
} from "react-native";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import { drag } from "@/theme/tokens";
import type { DropZoneMap } from "@/features/planner/lib/dropzone";
import type { DragApi, LiftState } from "@/features/planner/components/drag";
import { useTouchDragGate, type PendingDrag } from "./use-touch-drag-gate";

/*
 * The one home for drag in every planner mode (ADR 0025, amended). A
 * row, a pill or a week chip is pressed, held, lifted, dragged and
 * dropped here. The mode only says what a drop zone means: `resolve`
 * turns the zone under the finger into a patch for the task, or null
 * when the zone takes no drop.
 *
 * The motion stays on Animated values behind this hook, so the pager
 * and the ghost can move to the UI thread without a change to any
 * caller (tickets 0059 and 0061).
 */

/** The fields a drop writes. */
export type DragPatch = Partial<TaskFrontmatter>;

/** Where the ghost sits against the finger: the pointer is near the
    middle of its top edge. */
const grip = { x: -100, y: -40 };

/** How long a drop's leftover click stays suppressed. */
const clickGuardMs = 350;

/** The zone under the finger. Only the panes that draw it listen, so a
    move over a new zone never re-renders the rest of the screen. */
export type HoverStore = {
  get: () => string | null;
  subscribe: (listener: () => void) => () => void;
};

/** What a pane needs to take drops: the zone map the pane registers
    into, the hover it draws, and the node that clips the zones. */
export type DropTargets = {
  zones: DropZoneMap;
  hover: HoverStore;
  /** Set on the view whose rect bounds the zones, such as the
      timeline pane. Week and month leave it unset. */
  clip: (node: React.ComponentRef<typeof View> | null) => void;
};

/** The zone key under the finger, or null. Re-renders on change. */
export function useDragHover(hover: HoverStore | null): string | null {
  return React.useSyncExternalStore(
    hover?.subscribe ?? noSubscribe,
    hover?.get ?? noHover,
    hover?.get ?? noHover,
  );
}

const noSubscribe = () => () => undefined;
const noHover = () => null;

export type DragSessionOptions = {
  zones: DropZoneMap;
  /** The patch a drop on `hit` writes, or null when `hit` takes no
      drop. The hook calls it on every move, so keep it cheap. */
  resolve: (hit: string, task: TaskItem) => DragPatch | null;
  /** Runs the write for a drop. */
  write: (task: TaskItem, patch: DragPatch) => void;
  /** Web reads the pointer events; native reads the gesture library. */
  pointerPickup: boolean;
};

/** The root View's pointer wiring: whole on web, reset-only on native. */
type PointerHandlers = {
  onPointerDown: () => void;
  onPointerMove?: (e: RNPointerEvent) => void;
  onPointerUp?: () => void;
  onPointerCancel?: () => void;
};

/* Pointer modules: the closures below are created during render but
   only run on pointer events, so the react-hooks/refs rule cannot see
   their safety. */

export function useDragSession({
  zones,
  resolve,
  write,
  pointerPickup,
}: DragSessionOptions) {
  // The caller's rules change with the route day. A ref keeps every
  // callback below stable.
  const resolveRef = React.useRef(resolve);
  const writeRef = React.useRef(write);
  React.useEffect(() => {
    resolveRef.current = resolve;
    writeRef.current = write;
  }, [resolve, write]);

  // A press waiting to travel, the hold cue, and the drag itself.
  const [pending, setPendingState] = React.useState<PendingDrag | null>(null);
  const [dragging, setDraggingState] = React.useState<TaskItem | null>(null);
  const [holding, setHolding] = React.useState<TaskItem | null>(null);
  const [armed, setArmed] = React.useState<TaskItem | null>(null);
  const pendingRef = React.useRef<PendingDrag | null>(null);
  const draggingRef = React.useRef<TaskItem | null>(null);
  // The touch gate reads this: while a drag owns the pointer, the
  // panes lose their scrolling.
  const busyRef = React.useRef(false);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPending = React.useCallback((next: PendingDrag | null) => {
    pendingRef.current = next;
    setPendingState(next);
  }, []);
  const setDragging = React.useCallback((next: TaskItem | null) => {
    draggingRef.current = next;
    busyRef.current = next != null;
    setDraggingState(next);
  }, []);

  // The ghost follows an Animated value, not state: a pointer move
  // must not re-render the screen.
  const [ghostX] = React.useState(() => new Animated.Value(0));
  const [ghostY] = React.useState(() => new Animated.Value(0));
  const moveGhost = React.useCallback(
    (x: number, y: number) => {
      ghostX.setValue(x + grip.x);
      ghostY.setValue(y + grip.y);
    },
    [ghostX, ghostY],
  );

  // The zone under the finger lives outside React state, so a hover
  // change renders only the panes that draw it.
  const [hover] = React.useState(() => {
    let value: string | null = null;
    const listeners = new Set<() => void>();
    return {
      get: () => value,
      set: (next: string | null) => {
        if (next === value) {
          return;
        }
        value = next;
        listeners.forEach((listener) => listener());
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  });
  const hoverRead = React.useMemo<HoverStore>(
    () => ({ get: hover.get, subscribe: hover.subscribe }),
    [hover],
  );
  const clipRef = React.useRef<React.ComponentRef<typeof View> | null>(null);
  const setClip = React.useCallback((node: React.ComponentRef<typeof View> | null) => {
    clipRef.current = node;
  }, []);
  // The screen root. The touch gate listens on it, because touchmove
  // outraces pointermove.
  const rootRef = React.useRef<HTMLElement | null>(null);
  const setRoot = React.useCallback((node: unknown) => {
    rootRef.current = node as HTMLElement | null;
  }, []);

  // The click a drop leaves behind. Only a pointer gesture delivers a
  // click after the drop, so only the web path arms the guard: a
  // native tap must land.
  const suppress = React.useRef(false);
  const suppressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const armClick = React.useCallback(() => {
    suppress.current = true;
    if (suppressTimer.current != null) {
      clearTimeout(suppressTimer.current);
    }
    suppressTimer.current = setTimeout(() => {
      suppress.current = false;
      suppressTimer.current = null;
    }, clickGuardMs);
  }, []);
  React.useEffect(
    () => () => {
      if (suppressTimer.current != null) {
        clearTimeout(suppressTimer.current);
      }
    },
    [],
  );
  /** True once for the click a drop left behind. A press handler
      returns early when this is true. */
  const consumeClick = React.useCallback(() => {
    if (!suppress.current) {
      return false;
    }
    suppress.current = false;
    return true;
  }, []);

  const clearHoldTimer = React.useCallback(() => {
    if (holdTimer.current != null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);
  React.useEffect(() => clearHoldTimer, [clearHoldTimer]);
  const beginHold = React.useCallback(
    (task: TaskItem, kind: "pill" | "row") => {
      const wait = kind === "pill" ? drag.pillPickMs : drag.pickMs;
      setHolding(task);
      setArmed(null);
      clearHoldTimer();
      holdTimer.current = setTimeout(() => setArmed(task), wait);
    },
    [clearHoldTimer],
  );
  const endHold = React.useCallback(() => {
    clearHoldTimer();
    setHolding(null);
    setArmed(null);
  }, [clearHoldTimer]);

  // The source row tints through the hold and lifts once the hold is
  // armed or the drag owns the pointer.
  const lifted = React.useMemo<LiftState>(
    () =>
      dragging != null
        ? { task: dragging, phase: "picked" }
        : armed != null
          ? { task: armed, phase: "picked" }
          : pending != null
            ? { task: pending.task, phase: "hold" }
            : holding != null
              ? { task: holding, phase: "hold" }
              : null,
    [pending, dragging, holding, armed],
  );

  /** The zone under the page point, when the task may drop on it. */
  const hitAt = React.useCallback(
    (x: number, y: number, task: TaskItem): string | null => {
      const hit = zones.hit(x, y);
      return hit != null && resolveRef.current(hit, task) != null ? hit : null;
    },
    [zones],
  );

  /** The drag owns the pointer: measure the zones, place the ghost. */
  const begin = React.useCallback(
    (task: TaskItem, x: number, y: number) => {
      // The clip is read straight from its node: waiting on the zones'
      // completion callback means one zone that never answers leaves
      // the band unclipped for the whole drag.
      const node = clipRef.current;
      if (node?.measureInWindow) {
        node.measureInWindow((px, py, pw, ph) => {
          zones.setClip({ x: px, y: py, w: pw, h: ph });
        });
      } else {
        zones.setClip(null);
      }
      zones.measureAll();
      moveGhost(x, y);
      setDragging(task);
    },
    [zones, moveGhost, setDragging],
  );

  const promote = React.useCallback(
    (x: number, y: number) => {
      const press = pendingRef.current;
      if (press == null) {
        return;
      }
      begin(press.task, x, y);
      setPending(null);
    },
    [begin, setPending],
  );
  useTouchDragGate(rootRef, {
    busy: busyRef,
    pending: pendingRef,
    promote,
  });

  /** The drop: the zone's patch is written, and the click guard arms. */
  const finish = React.useCallback(() => {
    const task = draggingRef.current;
    if (task == null) {
      return;
    }
    const hit = hover.get();
    const patch = hit == null ? null : resolveRef.current(hit, task);
    if (patch != null) {
      writeRef.current(task, patch);
    }
    if (pointerPickup) {
      armClick();
    }
    setDragging(null);
    hover.set(null);
  }, [hover, pointerPickup, armClick, setDragging]);

  // Native drag sources drive the same machinery through here.
  const api = React.useMemo<DragApi>(
    () => ({
      hold: beginHold,
      releaseHold: endHold,
      pickup: (task, x, y) => {
        endHold();
        begin(task, x, y);
      },
      move: (x, y) => {
        const task = draggingRef.current;
        moveGhost(x, y);
        hover.set(task == null ? null : hitAt(x, y, task));
      },
      drop: finish,
    }),
    [beginHold, endHold, begin, moveGhost, hover, hitAt, finish],
  );

  /** A press on a task source: the web path. Native sources call
      `api` instead. */
  const startDrag = React.useCallback(
    (task: TaskItem, e: RNPointerEvent, kind: "pill" | "row" = "row") => {
      beginHold(task, kind);
      setPending({
        task,
        x: e.nativeEvent.pageX,
        y: e.nativeEvent.pageY,
        t: performance.now(),
        touch: (e.nativeEvent as { pointerType?: string }).pointerType === "touch",
        kind,
      });
    },
    [beginHold, setPending],
  );

  const onPointerMove = React.useCallback(
    (e: RNPointerEvent) => {
      const x = e.nativeEvent.pageX;
      const y = e.nativeEvent.pageY;
      const press = pendingRef.current;
      if (press != null) {
        const travel = Math.abs(x - press.x) + Math.abs(y - press.y);
        if (press.touch) {
          // Touch grammar: movement while still holding is a scroll.
          // Movement after the hold completed is a drag, however far
          // it jumps between move events. Pills hold for less: their
          // section has free space to scroll from without touching
          // them.
          const hold = press.kind === "pill" ? drag.pillPickMs : drag.pickMs;
          if (performance.now() - press.t < hold) {
            if (travel > drag.threshold) {
              setPending(null);
            }
            return;
          }
        } else if (travel <= drag.threshold) {
          return;
        }
        begin(press.task, x, y);
        setPending(null);
        return;
      }
      const task = draggingRef.current;
      if (task != null) {
        moveGhost(x, y);
        // Hit-test the zones: enter and leave do not fire on touch.
        hover.set(hitAt(x, y, task));
      }
    },
    [begin, moveGhost, hover, hitAt, setPending],
  );

  const onPointerUp = React.useCallback(() => {
    finish();
    setPending(null);
    endHold();
  }, [finish, setPending, endHold]);

  const onPointerDown = React.useCallback(() => {
    // A fresh gesture clears the drop's suppression. The timer stays
    // as the fallback for engines that skip pointerdown.
    suppress.current = false;
  }, []);

  const pointerHandlers = React.useMemo<PointerHandlers>(
    () =>
      pointerPickup
        ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
        : { onPointerDown },
    [pointerPickup, onPointerDown, onPointerMove, onPointerUp],
  );

  const dropTargets = React.useMemo<DropTargets>(
    () => ({ zones, hover: hoverRead, clip: setClip }),
    [zones, hoverRead, setClip],
  );

  return {
    /** The screen root's ref callback: the touch gate listens on it. */
    attachRoot: setRoot,
    pointerHandlers,
    lifted,
    /** The task in flight, for the ghost. */
    dragging,
    ghost: { x: ghostX, y: ghostY },
    api,
    startDrag,
    consumeClick,
    dropTargets,
  };
}
