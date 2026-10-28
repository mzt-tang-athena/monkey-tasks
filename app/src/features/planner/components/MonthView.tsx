import * as React from "react";
import { Pressable, Text, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { DropZoneMap } from "@/features/planner/lib/dropzone";
import { swipeProps } from "@/lib/swipe";
import { useSwipePager } from "@/components/SwipePager";
import { MonthGrid, type PickedDay } from "./MonthGrid";
import { WEEKDAYS_FULL } from "@/features/planner/lib/labels";
import { styles } from "./plannerStyles";

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
  pressGuard,
  dropZones,
  dragActive,
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
  /** Drag drops that land on a cell suppress that cell's pick. */
  pressGuard?: { current: boolean };
  /** Cells register here for move-based hit testing. */
  dropZones: DropZoneMap;
  dragActive: boolean;
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
        pressGuard={pressGuard}
        dropZones={dropZones}
        dragActive={dragActive}
        hoveredDay={hoveredDay}
      />
    ),
  });

  return (
    <View style={styles.monthColumn}>
      <View
        testID="month-pager"
        style={styles.monthFixed}
        {...swipeProps(controller)}
      >
        {page}
      </View>
      {children}
    </View>
  );
}

/** The tapped day's group header above the month list: its name, its
    date, and how many tasks it holds. The rows follow from the
    shared section, which spaces them, so this stays a label. */
export function MonthDayHeader({
  day,
  tasks,
}: {
  day: Date;
  tasks: TaskItem[];
}) {
  return (
    <Text style={styles.sectionLabel}>
      {WEEKDAYS_FULL[day.getDay()]} {day.getDate()}
      {"  "}
      {tasks.length}
    </Text>
  );
}

/** The month list's footer: the link into the day view. */
export function MonthOpenDayButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.monthDayOpen,
        pressed && styles.detailsPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="open this day"
    >
      <Text style={styles.monthDayOpenText}>Open in day view</Text>
    </Pressable>
  );
}
