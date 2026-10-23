import * as React from "react";
import { Pressable, Text, View } from "react-native";
import type { TaskItem } from "../../tasks/query";
import { DropZoneMap } from "../../../lib/dropzone";
import { startOfDay, isSameDay } from "../../../lib/dates";
import { makeSwipeController, swipeProps } from "../../../lib/swipe";
import { isDone, isoOf, startOfMonth } from "../model";
import { MONTHS, WEEKDAYS, WEEKDAYS_FULL } from "../lib/labels";
import { styles } from "./plannerStyles";

/** The tapped day, tagged with the month it belongs to. The
    container holds it, so a new month from the strip invalidates the
    pick without an effect. */
export type PickedDay = { key: string; day: Date } | null;

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
  const monthStart = startOfMonth(viewMonth);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const lead = monthStart.getDay();

  const byDay = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    if (task.data?.due == null || isDone(task)) {
      continue;
    }
    const iso = task.data.due.slice(0, 10);
    const bucket = byDay.get(iso);
    if (bucket) {
      bucket.push(task);
    } else {
      byDay.set(iso, [task]);
    }
  }
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(year, monthIdx, index + 1),
    ),
  ];

  // Swipe left/right on the fixed calendar areas shifts one month.
  // Created once; the shift callback is a stable functional updater.
  const [calendarSwipe] = React.useState(() =>
    makeSwipeController((dir) => onShiftMonth(dir === "left" ? 1 : -1)),
  );

  return (
    <View style={styles.monthColumn}>
      <View style={styles.monthFixed} {...swipeProps(calendarSwipe)}>
        <Text style={styles.monthTitle}>
          {MONTHS[monthIdx]} {year}
        </Text>
        <View style={styles.monthCard}>
          <View style={styles.monthHead}>
            {WEEKDAYS.map((name) => (
              <Text key={name} style={styles.monthHeadCell}>
                {name[0]}
              </Text>
            ))}
          </View>
          <View style={styles.monthGrid}>
            {cells.map((day, index) =>
              day == null ? (
                <View key={`blank-${index}`} style={styles.monthCell} />
              ) : (
                <Pressable
                  key={day.getTime()}
                  style={({ pressed }) => [
                    styles.monthCell,
                    isSameDay(day, picked?.day ?? null) &&
                      styles.monthCellPicked,
                    isSameDay(day, today) && styles.monthCellToday,
                    dragActive &&
                      isSameDay(day, hoveredDay) && styles.monthCellHovered,
                    pressed && styles.pressedFill,
                  ]}
                  onPress={() => {
                    // A drag drop that released over this cell
                    // suppresses the accidental pick.
                    if (pressGuard?.current) {
                      pressGuard.current = false;
                      return;
                    }
                    onPick(day);
                  }}
                  ref={(node) => {
                    dropZones.set(`day:${isoOf(day)}`, node);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
                >
                  <Text
                    style={[
                      styles.monthNum,
                      isSameDay(day, today) && styles.monthNumToday,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                  {/* The dot slot is always reserved, so every number
                      sits on one baseline with or without a dot. */}
                  <View style={styles.monthDotSlot}>
                    {byDay.has(isoOf(day)) ? (
                      <View style={styles.monthDot} />
                    ) : null}
                  </View>
                </Pressable>
              ),
            )}
          </View>
        </View>
      </View>
      {children}
    </View>
  );
}

/** The tapped day's group header above the month list: its name, its
    date, and how many tasks it holds. The rows follow from the
    shared section, so this stays a label. */
export function MonthDayHeader({
  day,
  tasks,
}: {
  day: Date;
  tasks: TaskItem[];
}) {
  return (
    <View style={styles.monthPickedBlock}>
      <Text style={styles.sectionLabel}>
        {WEEKDAYS_FULL[day.getDay()]} {day.getDate()}
        {"  "}
        {tasks.length}
      </Text>
    </View>
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

