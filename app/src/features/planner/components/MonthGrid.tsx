import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "../../tasks/query";
import { DropZoneMap } from "../../../lib/dropzone";
import { addDays, isSameDay } from "../../../lib/dates";
import { occurrencesBetween } from "../../tasks/recurrence";
import { isDone, isoOf, startOfMonth } from "../model";
import { MONTHS, WEEKDAYS, WEEKDAYS_FULL } from "../lib/labels";
import { spacing } from "../../../theme/tokens";
import { styles } from "./plannerStyles";

/** The tapped day, tagged with the month it belongs to. The
    container holds it, so a new month from the strip invalidates the
    pick without an effect. */
export type PickedDay = { key: string; day: Date } | null;

/** One month: the title and the grid card. The pager keeps a live copy
    in its centre cell and a still copy in the cell the finger travels
    toward; only the live one takes taps and drops, so the still copy
    looks the same without owning the gesture. */
export function MonthGrid({
  viewMonth,
  tasks,
  today,
  picked,
  interactive,
  onPick,
  pressGuard,
  dropZones,
  dragActive = false,
  hoveredDay = null,
}: {
  viewMonth: Date;
  tasks: TaskItem[];
  today: Date;
  /** The container owns the pick; the grid only renders it. */
  picked: PickedDay;
  /** False for a neighbour page: it shows the month, it does not
      answer taps or accept drops. */
  interactive: boolean;
  onPick?: (day: Date) => void;
  /** Drag drops that land on a cell suppress that cell's pick. */
  pressGuard?: { current: boolean };
  dropZones?: DropZoneMap;
  dragActive?: boolean;
  hoveredDay?: Date | null;
}) {
  const year = viewMonth.getFullYear();
  const monthIdx = viewMonth.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const lead = startOfMonth(viewMonth).getDay();

  // One rule pass per task over the whole grid, lead blanks included.
  // The range ends at the close of the last week row, so trailing
  // cells keep their dots if the grid ever pads them.
  const dotted = React.useMemo(() => {
    const year = viewMonth.getFullYear();
    const monthIdx = viewMonth.getMonth();
    const lead = startOfMonth(viewMonth).getDay();
    const days = new Date(year, monthIdx + 1, 0).getDate();
    const gridStart = addDays(startOfMonth(viewMonth), -lead);
    const gridEnd = addDays(gridStart, Math.ceil((lead + days) / 7) * 7 - 1);
    const iso = new Set<string>();
    for (const task of tasks) {
      if (isDone(task)) {
        continue;
      }
      for (const day of occurrencesBetween(task, gridStart, gridEnd)) {
        iso.add(isoOf(day));
      }
    }
    return iso;
  }, [tasks, viewMonth]);

  // Six rows, always: a month that needs five pads with trailing
  // blanks, so the card is the same height every month and the pane
  // below never jumps when the month changes.
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(year, monthIdx, index + 1),
    ),
  ];
  while (cells.length < 42) {
    cells.push(null);
  }

  return (
    <View style={gridStyles.root}>
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
          {cells.map((day, index) => {
            if (day == null) {
              return <View key={`blank-${index}`} style={styles.monthCell} />;
            }
            const marks = [
              styles.monthCell,
              isSameDay(day, picked?.day ?? null) && styles.monthCellPicked,
              isSameDay(day, today) && styles.monthCellToday,
              dragActive &&
                isSameDay(day, hoveredDay) && styles.monthCellHovered,
            ];
            const face = (
              <>
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
                  {dotted.has(isoOf(day)) ? (
                    <View style={styles.monthDot} testID="month-dot" />
                  ) : null}
                </View>
              </>
            );
            if (!interactive) {
              return (
                <View key={day.getTime()} style={marks}>
                  {face}
                </View>
              );
            }
            return (
              <Pressable
                key={day.getTime()}
                style={({ pressed }) => [
                  ...marks,
                  pressed && styles.pressedFill,
                ]}
                onPress={() => {
                  // A drag drop that released over this cell
                  // suppresses the accidental pick.
                  if (pressGuard?.current) {
                    pressGuard.current = false;
                    return;
                  }
                  onPick?.(day);
                }}
                ref={(node) => {
                  dropZones?.set(`day:${isoOf(day)}`, node);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
              >
                {face}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const gridStyles = StyleSheet.create({
  // The page keeps its content height inside the pager's stretch.
  // The title sits one step over the card.
  root: {
    flexShrink: 0,
    gap: spacing.s,
  },
});
