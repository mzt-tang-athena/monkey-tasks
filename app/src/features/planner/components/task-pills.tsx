import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Landing } from "@/components/motion/landing";
import type { TaskItem } from "@/types/task";
import { pillDateLabel } from "@/features/planner/lib/labels";
import { PlanDrag } from "@/features/planner/lib/plan-drag";
import { fonts, radii, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** Round-1 tray pills, back as draggable chips: drag-first, no tick. */
export function TaskPills({ tasks, copy = false }: { tasks: TaskItem[]; copy?: boolean }) {
  const { styles } = useThemedStyles(makeStyles);
  if (tasks.length === 0) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      {tasks.map((task) => {
        const face = (
          <>
            <View style={styles.grip}>
              <View style={styles.gripDot} />
              <View style={styles.gripDot} />
            </View>
            {/* A placed pill carries its date; dragging moves it. */}
            {task.data?.due != null ? (
              <Text style={styles.date}>{pillDateLabel(task)}</Text>
            ) : null}
            <Text style={styles.text} numberOfLines={1}>
              {task.name}
            </Text>
          </>
        );
        const chip = <View style={styles.chip}>{face}</View>;
        return copy ? (
          <React.Fragment key={task.id}>{chip}</React.Fragment>
        ) : (
          <PlanDrag.Source key={task.id} payload={task} hold="pill" testID={`pill:${task.name}`}>
            <Landing id={task.id}>{chip}</Landing>
          </PlanDrag.Source>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    wrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.s,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      borderRadius: radii.pill,
      paddingLeft: spacing.m,
      paddingRight: spacing.m,
      paddingVertical: spacing.s,
      maxWidth: "100%",
    },
    grip: {
      alignItems: "center",
      gap: 2,
    },
    gripDot: {
      width: 10,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.inkFaint,
    },
    text: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: fonts.body,
      color: colors.ink,
    },
    date: {
      fontSize: 11,
      lineHeight: 15,
      fontFamily: fonts.body,
      color: colors.inkMuted,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
  }),
});
