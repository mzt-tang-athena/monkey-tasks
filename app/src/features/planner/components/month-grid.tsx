import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { Pressable } from "@/components/ui/pressable";
import { addDays, isoOf, isSameDay } from "@/utils/dates";
import { occurrencesBetween } from "@/lib/recurrence";
import { isDone, startOfMonth } from "@/features/planner/model";
import { PlanDrag } from "@/features/planner/lib/plan-drag";
import { MONTHS, WEEKDAYS, WEEKDAYS_FULL } from "@/features/planner/lib/labels";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

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
    <View style={styles.root}>
      {/* Only the live month carries the test id: the pager also draws
          the month beside it while a swipe travels. */}
      <Text testID={interactive ? "month-title" : undefined} style={styles.title}>
        {MONTHS[monthIdx]} {year}
      </Text>
      <View style={styles.card}>
        <View style={styles.head}>
          {WEEKDAYS.map((name) => (
            <Text key={name} style={styles.headCell}>
              {name[0]}
            </Text>
          ))}
        </View>
        <GridBody interactive={interactive} cells={cells} picked={picked} today={today} dotted={dotted} onPick={onPick} />
      </View>
    </View>
  );
}

function GridBody({
  interactive,
  cells,
  picked,
  today,
  dotted,
  onPick,
}: {
  interactive: boolean;
  cells: (Date | null)[];
  picked: PickedDay;
  today: Date;
  dotted: Set<string>;
  onPick?: (day: Date) => void;
}) {
  const views = cells.map((day, index) => {
    if (day == null) {
      return <View key={`blank-${index}`} style={styles.cell} />;
    }
    const marks = [
      styles.cell,
      isSameDay(day, picked?.day ?? null) && styles.cellPicked,
      isSameDay(day, today) && styles.cellToday,
    ];
    const face = (
      <>
        <Text style={[styles.num, isSameDay(day, today) && styles.numToday]}>
          {day.getDate()}
        </Text>
        {/* The dot slot is always reserved, so every number sits on
            one baseline with or without a dot. */}
        <View style={styles.dotSlot}>
          {dotted.has(isoOf(day)) ? <View style={styles.dot} testID="month-dot" /> : null}
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
        style={({ pressed }) => [...marks, pressed && styles.pressed]}
        onPress={() => onPick?.(day)}
        accessibilityRole="button"
        accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
      >
        {face}
      </Pressable>
    );
  });
  if (!interactive) {
    return <View style={styles.grid}>{views}</View>;
  }
  return (
    <PlanDrag.Grid
      columns={7}
      rows={6}
      cells={cells.map((day) => (day == null ? null : { kind: "day", iso: isoOf(day) }))}
      style={styles.grid}
    >
      {views}
    </PlanDrag.Grid>
  );
}

const styles = StyleSheet.create({
  // The page keeps its content height inside the pager's stretch.
  // The title sits one step over the card.
  root: {
    flexShrink: 0,
    gap: spacing.s,
  },
  pressed: {
    backgroundColor: colors.pressed,
  },
  title: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.m,
  },
  head: {
    flexDirection: "row",
  },
  headCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "14.28%",
    aspectRatio: 1.1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: radius,
  },
  cellPicked: {
    backgroundColor: colors.accentSoft,
  },
  cellToday: {
    backgroundColor: colors.accentSoft,
  },
  num: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  numToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  dotSlot: {
    height: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
