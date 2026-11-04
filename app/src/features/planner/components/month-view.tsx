import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { DropZoneMap } from "@/features/planner/lib/dropzone";
import { swipeProps } from "@/lib/swipe";
import { useSwipePager } from "@/components/swipe-pager";
import { pageGutter, spacing } from "@/theme/tokens";
import { MonthGrid, type PickedDay } from "./month-grid";

/** The fixed half of the month: the title and the grid card. The
    container passes the picked-day list pane as children, so both
    halves share one column. */
export function MonthView({
  viewMonth,
  today,
  tasks,
  picked,
  onPick,
  onShiftMonth,
  dropZones,
  hoveredDay,
  children,
}: {
  viewMonth: Date;
  today: Date;
  tasks: TaskItem[];
  /** The container owns the pick; the card only renders it. */
  picked: PickedDay;
  onPick: (day: Date) => void;
  /** Swipe left/right on the fixed calendar shifts a whole month. */
  onShiftMonth: (delta: 1 | -1) => void;
  /** Cells register here for move-based hit testing. */
  dropZones: DropZoneMap;
  hoveredDay: Date | null;
  /** The picked-day list pane; both halves share one column. */
  children?: React.ReactNode;
}) {
  const year = viewMonth.getFullYear();
  const monthIdx = viewMonth.getMonth();
  const monthKey = `${year}-${monthIdx}`;

  const { controller, page } = useSwipePager({
    // The grid sets the height of the fixed half.
    fill: false,
    pageKey: monthKey,
    // Every month has a neighbour, so a swipe always lands on one and
    // the fixed half never rubber-bands.
    canGo: () => true,
    onPage: (dir) => onShiftMonth(dir === "left" ? 1 : -1),
    renderNeighbor: (dir) => (
      <MonthGrid
        viewMonth={new Date(year, monthIdx + (dir === "left" ? 1 : -1), 1)}
        tasks={tasks}
        today={today}
        picked={picked}
        interactive={false}
      />
    ),
    children: (
      <MonthGrid
        viewMonth={viewMonth}
        tasks={tasks}
        today={today}
        picked={picked}
        interactive
        onPick={onPick}
        dropZones={dropZones}
        hoveredDay={hoveredDay}
      />
    ),
  });

  return (
    <View style={styles.column}>
      <View testID="month-pager" style={styles.fixed} {...swipeProps(controller)}>
        {page}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // The month sits in the week and month frame, which has no gutter.
  column: {
    flex: 1,
    gap: spacing.m,
    paddingHorizontal: pageGutter,
  },
  // The fixed half: title and grid card. Its own swipe zone shifts
  // months without touching the row drags beneath.
  fixed: {
    flexShrink: 0,
  },
});
