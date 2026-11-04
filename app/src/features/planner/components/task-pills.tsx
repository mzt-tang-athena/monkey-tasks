import { StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { pillDateLabel } from "@/features/planner/lib/labels";
import { colors, fonts, radii, spacing } from "@/theme/tokens";
import { Pickup } from "./drag";
import { usePlannerList } from "./planner-list-context";

/** Round-1 tray pills, back as draggable chips: drag-first, no tick. */
export function TaskPills({ tasks }: { tasks: TaskItem[] }) {
  const { lifted, api, dragStart } = usePlannerList();
  if (tasks.length === 0) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      {tasks.map((task) => (
        <Pickup
          key={task.id}
          task={task}
          kind="pill"
          api={api}
          lifted={lifted}
          onPointerDown={(e) => dragStart(task, e, "pill")}
          style={styles.chip}
        >
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
        </Pickup>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
