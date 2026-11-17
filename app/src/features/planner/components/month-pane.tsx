import * as React from "react";
import { StyleSheet, Text } from "react-native";
import type { TaskItem } from "@/types/task";
import { Pressable } from "@/components/ui/pressable";
import { SectionHeader } from "@/components/ui/section-header";
import { WEEKDAYS_FULL } from "@/features/planner/lib/labels";
import type { PlannerMonth } from "@/features/planner/hooks/use-planner-month";
import { fonts, radius, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { layout } from "../planner-layout";
import { usePlannerList } from "./planner-list-context";
import { MonthView } from "./month-view";
import { TaskListSection } from "./task-list-section";

/**
 * The month body: the calendar card, and under it the list pane. The
 * pane lists the source's month until a day is picked, then that day's
 * tasks with its header and the link into the day view. The pane takes
 * the picked day from the screen, so it survives a visit to another
 * mode. A new month clears it.
 */
export function MonthPane({
  month,
  tasks,
  day,
  today,
  onSelectMonth,
  onOpenDay,
}: {
  /** The month state, held by the screen. */
  month: PlannerMonth;
  tasks: TaskItem[];
  day: Date;
  today: Date;
  /** A strip tap or a page landing picks the month. */
  onSelectMonth: (month: Date) => void;
  onOpenDay: (day: Date) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const { source } = usePlannerList();
  const { picked, setPicked, viewMonth, monthKey, pickedDay, monthRows, pickedTasks } =
    month;

  const pick = React.useCallback(
    (next: Date) => {
      setPicked({ key: monthKey, day: next });
    },
    [setPicked, monthKey],
  );

  const header = React.useMemo(
    () =>
      pickedDay == null ? undefined : (
        <SectionHeader
          label={`${WEEKDAYS_FULL[pickedDay.getDay()]} ${pickedDay.getDate()}`}
          count={pickedTasks.length}
        />
      ),
    [pickedDay, pickedTasks.length],
  );
  const footer = React.useMemo(
    () =>
      pickedDay == null ? undefined : (
        <Pressable
          style={({ pressed }) => [styles.open, pressed && styles.openPressed]}
          onPress={() => onOpenDay(pickedDay)}
          accessibilityRole="button"
          accessibilityLabel="open this day"
        >
          <Text style={styles.openText}>Open in day view</Text>
        </Pressable>
      ),
    [pickedDay, onOpenDay, styles],
  );

  return (
    <MonthView
      viewMonth={viewMonth}
      today={today}
      tasks={tasks}
      picked={picked}
      onPick={pick}
      onSelectMonth={onSelectMonth}
    >
      {/* The pane under the card: the source's month list until a day
          is picked, then that day's tasks. */}
      <TaskListSection
        style={layout.paneScroll}
        mode="month"
        day={day}
        tasks={pickedDay == null ? monthRows : pickedTasks}
        header={header}
        footer={footer}
        emptyLabel={
          pickedDay == null
            ? source === "due-period"
              ? "Nothing scheduled this month."
              : `Nothing on ${source} yet.`
            : "Nothing scheduled."
        }
      />
    </MonthView>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    open: {
      alignSelf: "flex-start",
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing.m,
      borderRadius: radius,
    },
    openPressed: {
      backgroundColor: colors.pressed,
    },
    openText: {
      fontSize: 13,
      lineHeight: 17,
      fontFamily: fonts.body,
      color: colors.accent,
      fontWeight: "600",
    },
  }),
});
