import { StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { NoPanPressable as Pressable } from "@/components/ui/pressable";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { addDays, isoOf, startOfDay } from "@/utils/dates";
import { sortDay } from "@/features/planner/lib/day-rows";
import { PlanDrag } from "@/features/planner/lib/plan-drag";
import {
  hasTime,
  startOfWeek,
  tasksForDay,
  timeOf,
} from "@/features/planner/model";
import { WEEKDAYS, WEEKDAYS_FULL } from "@/features/planner/lib/labels";
import {
  colors,
  fonts,
  pageGutter,
  radius,
  spacing,
  weekCanvasHeight,
  weekColWidth,
} from "@/theme/tokens";

/*
 * A column has a fixed height, so it shows the chips that fit and a
 * "+N more" line for the rest. Every chip is two text lines tall, so
 * the count is arithmetic and needs no layout pass. A name past two
 * lines ends in an ellipsis; the day view shows it whole.
 */
const chipLines = 2;
const chipLineHeight = 15;
const chipHeight = chipLines * chipLineHeight + 2 * spacing.xs;
const chipGap = spacing.xs;
const moreHeight = 18;
// The column's height inside the canvas padding, less its own padding,
// the day's name and number, and the rule under them.
const columnHeight = weekCanvasHeight - 2 * spacing.xs;
const headHeight = 14 + 24 + 2 * spacing.s + 1;
const chipSpace = columnHeight - 2 * spacing.s - headHeight;

/** How many chips of `count` a column draws. When they all fit, all of
    them. Otherwise the ones that fit beside the "+N more" line. */
export function weekChipCount(count: number): number {
  const fit = (space: number) => Math.floor((space + chipGap) / (chipHeight + chipGap));
  if (count <= fit(chipSpace)) {
    return count;
  }
  return fit(chipSpace - moreHeight - chipGap);
}

/** F's week body: day columns with real content, one swipe away. */
export function WeekView({
  tasks,
  today,
  selected,
  onSelect,
  onOpenDay,
}: {
  tasks: TaskItem[];
  today: Date;
  selected: Date;
  onSelect: (date: Date) => void;
  /** The "+N more" line opens that day in the day view. */
  onOpenDay: (date: Date) => void;
}) {
  const todayStart = startOfDay(today).getTime();
  // The strip picks the week; its seven columns start on Sunday.
  const weekStart = startOfWeek(selected);
  const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(weekStart, offset));
  return (
    <MotionScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.canvas}
    >
      <PlanDrag.Grid
        columns={7}
        rows={1}
        cells={days.map((day) => ({ kind: "day", iso: isoOf(day) }))}
        style={styles.columns}
      >
        {days.map((day) => {
          const items = sortDay(tasksForDay(tasks, day));
          const shown = weekChipCount(items.length);
          const hidden = items.length - shown;
          const isToday = startOfDay(day).getTime() === todayStart;
          const isSelected =
            startOfDay(day).getTime() === startOfDay(selected).getTime();
          return (
            <Pressable
              key={day.getTime()}
              style={({ pressed }) => [
                styles.col,
                isSelected && !isToday && styles.colSelected,
                isToday && styles.colToday,
                pressed && styles.pressed,
              ]}
              onPress={() => onSelect(day)}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
            >
              <Text style={styles.dayName}>
                {isToday ? "Today" : WEEKDAYS[day.getDay()]}
              </Text>
              <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>
                {day.getDate()}
              </Text>
              <View style={styles.ruleSlot}>
                <View style={styles.rule} />
              </View>
              {items.length > 0 ? (
                <View style={styles.tasks}>
                  {items.slice(0, shown).map((task) => (
                    <PlanDrag.Source
                      key={task.id}
                      payload={task}
                      hold="row"
                      testID={`week-task:${task.name}`}
                      style={styles.task}
                    >
                      <View style={styles.bar} />
                      <Text style={styles.taskText} numberOfLines={chipLines}>
                        {hasTime(task) ? `${timeOf(task)}  ` : ""}
                        {task.name}
                      </Text>
                    </PlanDrag.Source>
                  ))}
                  {hidden > 0 ? (
                    <Pressable
                      style={styles.more}
                      onPress={() => onOpenDay(day)}
                      accessibilityRole="button"
                      accessibilityLabel={`${hidden} more on ${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}, open the day`}
                    >
                      <Text style={styles.moreText}>{`+${hidden} more`}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.free}>free</Text>
              )}
            </Pressable>
          );
        })}
      </PlanDrag.Grid>
    </MotionScrollView>
  );
}

const styles = StyleSheet.create({
  // The scroller bleeds to the screen's edges: columns cut at the
  // display, not the page gutter, and scroll till the last one clears
  // it. The bounded height keeps tall viewports from stretching the
  // columns into the bottom section's space.
  scroller: {
    flexGrow: 0,
    flexShrink: 0,
    height: weekCanvasHeight,
  },
  canvas: {
    paddingVertical: spacing.xs,
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
  },
  // The seven columns are one grid, so a drop reads the cell under the
  // finger from the grid's own rect.
  columns: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.s,
  },
  pressed: {
    backgroundColor: colors.pressed,
  },
  col: {
    width: weekColWidth,
    height: columnHeight,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius,
    padding: spacing.s,
  },
  colSelected: {
    borderColor: colors.accent,
  },
  colToday: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  dayName: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dayNum: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  dayNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  // The rule under the day's name, a step clear of the name and the
  // tasks.
  ruleSlot: {
    paddingVertical: spacing.s,
  },
  rule: {
    height: 1,
    backgroundColor: colors.hairline,
  },
  tasks: {
    gap: chipGap,
  },
  task: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    height: chipHeight,
    backgroundColor: colors.paper,
    borderRadius: radius,
    padding: spacing.xs,
  },
  bar: {
    alignSelf: "stretch",
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
  },
  taskText: {
    flex: 1,
    fontSize: 11,
    lineHeight: chipLineHeight,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  more: {
    height: moreHeight,
    justifyContent: "center",
    borderRadius: radius,
  },
  moreText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
  free: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    textAlign: "center",
  },
});
