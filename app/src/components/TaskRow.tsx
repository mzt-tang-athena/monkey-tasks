import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "../features/tasks/query";
import { parseStoredDate, startOfDay } from "../lib/dates";
import { theme } from "../theme/tokens";

/**
 * Task row, variant A: checkbox circle, name, muted due info line.
 * Ships pressed and disabled states; completed is a data state.
 */
export function TaskRow({
  task,
  onToggle,
  disabled = false,
}: {
  task: TaskItem;
  onToggle: (task: TaskItem) => void;
  disabled?: boolean;
}) {
  const done = task.data?.completed != null && task.data.completed !== "";
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  const overdue =
    !done && due != null && startOfDay(due.date).getTime() < startOfToday();
  const secondary = due ? secondaryLabel(due, overdue) : null;

  return (
    <Pressable
      accessibilityLabel={done ? "mark not done" : "mark done"}
      disabled={disabled}
      onPress={() => onToggle(task)}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      <View style={[styles.circle, done && styles.circleDone]}>
        {done ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.name, done && styles.nameDone]} numberOfLines={2}>
          {task.name}
        </Text>
        {secondary && !done ? (
          <Text
            style={[
              styles.secondary,
              overdue && styles.secondaryOverdue,
            ]}
          >
            {secondary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Loading placeholder row; renders while a task list is unavailable. */
export function TaskRowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.skeletonCircle} />
      <View style={styles.skeletonLines}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, styles.skeletonShort]} />
      </View>
    </View>
  );
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Muted due info line: time only, red with an Overdue note when past due. */
function secondaryLabel(
  due: { date: Date; hasTime: boolean },
  overdue: boolean,
): string | null {
  const time = due.hasTime ? formatTime(due.date) : null;
  if (overdue) {
    return time ? `Overdue · ${time}` : "Overdue";
  }
  return time;
}

function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${h}:${String(date.getMinutes()).padStart(2, "0")} ${ampm}`;
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 44,
    paddingVertical: theme.spacing[2],
    paddingRight: theme.spacing[2],
  },
  rowPressed: {
    backgroundColor: theme.colors.accentSoft,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  circle: {
    alignItems: "center",
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radii.pill,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    marginRight: theme.spacing[3],
    width: 20,
  },
  circleDone: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  check: {
    color: theme.colors.onAccent,
    fontSize: 12,
    fontWeight: theme.weights.bold,
    lineHeight: 14,
  },
  textBlock: {
    flex: 1,
  },
  name: {
    color: theme.colors.text,
    fontSize: theme.type.body.fontSize,
    fontWeight: theme.weights.medium,
    lineHeight: theme.type.body.lineHeight,
  },
  nameDone: {
    color: theme.colors.textFaint,
    textDecorationLine: "line-through",
  },
  secondary: {
    color: theme.colors.textMuted,
    fontSize: theme.type.small.fontSize,
    lineHeight: theme.type.small.lineHeight,
    marginTop: 2,
  },
  secondaryOverdue: {
    color: theme.colors.danger,
  },
  skeletonCircle: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 2,
    height: 20,
    marginRight: theme.spacing[3],
    width: 20,
  },
  skeletonLines: {
    flex: 1,
    gap: theme.spacing[2],
  },
  skeletonLine: {
    backgroundColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    height: 10,
    width: "72%",
  },
  skeletonShort: {
    width: "40%",
  },
});
