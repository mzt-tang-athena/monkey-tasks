import * as React from "react";
import { Platform, View, type PointerEvent as RNPointerEvent } from "react-native";
import type { TaskItem } from "@/types/task";
import { swipeProps } from "@/lib/swipe";
import { useSwipePager } from "@/components/swipe-pager";
import { addDays, isoOf } from "@/utils/dates";
import { dayRows } from "@/features/planner/lib/day-rows";
import type { Mode } from "@/features/planner/model";
import { PlannerHeader } from "../planner-header";
import { usePlannerList } from "../planner-list-context";
import { layout } from "../../planner-layout";
import { DayPage } from "./day-page";
import { DayPreview } from "./day-preview";

/** The pager's flex slot, directly under the stationary header. */
const bodyFrame = { flex: 1 } as const;

/**
 * The day composition: the stationary header, and under it the pager
 * that slides the day page. A swipe on the background turns the day.
 * The split owns its own grabber and the drag surface owns the rows,
 * so neither needs a claim on the swipe.
 *
 * The pager's cell and the preview both draw `DayPage`; the preview
 * draws the same split still.
 */
export function DaySpread({
  date,
  today,
  tasks,
  fraction,
  onResize,
  onMode,
  onSelectStrip,
  onShiftDay,
}: {
  date: Date;
  today: Date;
  tasks: TaskItem[];
  /** The day's split, shared by the live page and the preview. */
  fraction: number;
  onResize: (fraction: number) => void;
  onMode: (mode: Mode) => void;
  onSelectStrip: (date: Date) => void;
  /** Swipe left/right on the background shifts one day. */
  onShiftDay: (delta: 1 | -1) => void;
}) {
  const live = usePlannerList();
  const { source, taskForm } = live;

  // The day's rows. The live page and the preview read the same
  // function, so a recurrence shows in both.
  const rows = React.useMemo(
    () => dayRows({ tasks, day: date, today, source, taskForm }),
    [tasks, date, today, source, taskForm],
  );

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
        fraction={fraction}
      />
    ),
    children: (
      <DayPage
        date={date}
        today={today}
        rows={rows}
        fraction={fraction}
        onResize={onResize}
      />
    ),
  });

  return (
    <View
      style={layout.dayRoot}
      {...(Platform.OS === "web"
        ? {
            onPointerDown: (e: RNPointerEvent) => {
              swipe.down(e.nativeEvent.pageX, e.nativeEvent.pageY);
            },
            onPointerMove: (e: RNPointerEvent) => {
              swipe.move(e.nativeEvent.pageX, e.nativeEvent.pageY);
            },
            onPointerUp: () => {
              swipe.up();
            },
            onPointerCancel: () => {
              swipe.up();
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
      <View testID="day-pager" style={bodyFrame}>
        {paged}
      </View>
    </View>
  );
}
