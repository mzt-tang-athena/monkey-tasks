import * as React from "react";
import { View, type PointerEvent as RNPointerEvent } from "react-native";
import type { TaskItem } from "@/types/task";
import { swipeProps, type SwipeController } from "@/lib/swipe";
import { useSwipePager } from "@/components/swipe-pager";
import { addDays, isoOf } from "@/utils/dates";
import { dayRows } from "@/features/planner/lib/day-rows";
import type { Mode } from "@/features/planner/model";
import type { DropTargets } from "@/features/planner/hooks/use-drag-session";
import { useSplitPane } from "@/features/planner/hooks/use-split-pane";
import {
  useTouchDragGate,
  type PendingDrag,
} from "@/features/planner/hooks/use-touch-drag-gate";
import { pointerPickup } from "../drag";
import { PlannerHeader } from "../planner-header";
import { PlannerListProvider, usePlannerList } from "../planner-list-context";
import { layout } from "../../planner-layout";
import { DayPage } from "./day-page";
import { DayPreview } from "./day-preview";
import { useClaimedList } from "./use-claimed-list";

/** The pager's flex slot, directly under the stationary header. */
const bodyFrame = { flex: 1 } as const;

const noop = () => undefined;

/**
 * The day composition: the stationary header, and under it the pager
 * that slides the day page. A swipe on the background turns the day.
 * A press on a task or on the grabber claims the gesture, so a drag
 * or a resize never also turns the day.
 *
 * Drag lives in `useDragSession`, above this component. The day adds
 * only the claim: a pickup or a resize tells the swipe to stand down.
 * The pager's cell and the preview both draw `DayPage`.
 */
export function DaySpread({
  date,
  today,
  tasks,
  onMode,
  onSelectStrip,
  onShiftDay,
  drop,
}: {
  date: Date;
  today: Date;
  tasks: TaskItem[];
  onMode: (mode: Mode) => void;
  onSelectStrip: (date: Date) => void;
  /** Swipe left/right on the background shifts one day. */
  onShiftDay: (delta: 1 | -1) => void;
  drop: DropTargets;
}) {
  const live = usePlannerList();
  const { source, taskForm } = live;

  // The day swipe: armed only from a touch that did NOT start on a
  // task row or the grabber. Rows set taskTouched on their own
  // pointerdown, and the root's pointerdown reads it right after, so a
  // drag start claims the whole gesture. The pager hands back its
  // controller after the body is built, so the claim reads it by ref.
  const taskTouched = React.useRef(false);
  const swipeRef = React.useRef<SwipeController | null>(null);
  const claim = React.useCallback(() => {
    taskTouched.current = true;
    swipeRef.current?.claim();
  }, []);

  const split = useSplitPane({ claim });

  // The day's rows. The live page and the preview read the same
  // function, so a recurrence shows in both.
  const rows = React.useMemo(
    () => dayRows({ tasks, day: date, today, source, taskForm }),
    [tasks, date, today, source, taskForm],
  );

  // The list context for the day: the screen's, plus the claim on
  // every way a drag can start. The api keeps one identity.
  const dayList = useClaimedList(live, claim);

  // Days are unbounded, so every swipe has a neighbour day to reveal.
  // Only the body pages: the header above it never moves, and the
  // current page keeps its identity and its scroll for the gesture.
  const { controller: swipe, page: paged } = useSwipePager({
    pageKey: isoOf(date),
    canGo: () => true,
    onPage: (dir) => onShiftDay(dir === "left" ? 1 : -1),
    renderNeighbor: (dir) => (
      <DayPreview
        date={addDays(date, dir === "left" ? 1 : -1)}
        today={today}
        tasks={tasks}
        timelineHeight={split.timelineHeight}
      />
    ),
    children: (
      <DayPage
        date={date}
        today={today}
        rows={rows}
        timelineHeight={split.timelineHeight}
        drop={drop}
        split={split}
      />
    ),
  });
  React.useEffect(() => {
    swipeRef.current = swipe;
  }, [swipe]);

  // While a resize owns the pointer, the browser must keep its hands
  // off the pane scrolling. The drag's own gate sits on the screen
  // root; this one only holds the touch for the grabber.
  const rootRef = React.useRef<HTMLElement | null>(null);
  const noPending = React.useRef<PendingDrag | null>(null);
  useTouchDragGate(rootRef, {
    busy: split.busy,
    pending: noPending,
    promote: noop,
  });

  return (
    <PlannerListProvider value={dayList}>
      <View
        ref={(node) => {
          rootRef.current = node as HTMLElement | null;
        }}
        style={layout.dayRoot}
        onLayout={(e) => split.onRootLayout(e.nativeEvent.layout.height)}
        {...(pointerPickup
          ? {
              onPointerDown: (e: RNPointerEvent) => {
                swipe.down(
                  e.nativeEvent.pageX,
                  e.nativeEvent.pageY,
                  taskTouched.current,
                );
                taskTouched.current = false;
              },
              onPointerMove: (e: RNPointerEvent) => {
                swipe.move(e.nativeEvent.pageX, e.nativeEvent.pageY);
                split.move(e.nativeEvent.pageY);
              },
              onPointerUp: () => {
                swipe.up();
                split.end();
              },
              onPointerCancel: () => {
                swipe.up();
                split.end();
              },
            }
          : // Android gets no pointer events, so the same tripwire reads
            // the responder system there. A responder on the parent of a
            // scroller still sees the moves, which a gesture handler
            // would not.
            swipeProps(swipe))}
      >
        <PlannerHeader
          mode="day"
          selected={date}
          today={today}
          onSelect={onSelectStrip}
          onMode={onMode}
        />
        {/* The pager sits under the header: only the day body slides,
            so the date strip and the mode switch never move. */}
        <View
          testID="day-pager"
          style={bodyFrame}
          onLayout={(e) => split.onBodyLayout(e.nativeEvent.layout.y)}
        >
          {paged}
        </View>
      </View>
    </PlannerListProvider>
  );
}
