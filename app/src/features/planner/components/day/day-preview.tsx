import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { dayRows } from "@/features/planner/lib/day-rows";
import { spacing } from "@/theme/tokens";
import {
  PlannerListProvider,
  useInertList,
} from "../planner-list-context";
import { DayPage } from "./day-page";

/**
 * The neighbouring day as the swipe reveals it: the same page the live
 * day draws, from the same rows, held still. Nothing here takes a
 * pointer, so the gesture that reveals it keeps owning the touch until
 * it commits or springs back, and the swap to the live body moves
 * nothing.
 */
export function DayPreview({
  date,
  today,
  tasks,
  timelineHeight,
}: {
  date: Date;
  today: Date;
  tasks: TaskItem[];
  timelineHeight: number;
}) {
  const inert = useInertList();
  const { source, taskForm } = inert;
  const rows = React.useMemo(
    () => dayRows({ tasks, day: date, today, source, taskForm }),
    [tasks, date, today, source, taskForm],
  );
  return (
    <PlannerListProvider value={inert}>
      <View style={styles.preview} pointerEvents="none">
        <DayPage
          copy
          date={date}
          today={today}
          rows={rows}
          timelineHeight={timelineHeight}
        />
      </View>
    </PlannerListProvider>
  );
}

const styles = StyleSheet.create({
  // The live day page's spacing: heading, then the split.
  preview: {
    flex: 1,
    overflow: "hidden",
    gap: spacing.m,
  },
});
