import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "../features/tasks/query";
import { formatTime24, parseStoredDate } from "../lib/dates";
import { t } from "../theme/tokens";

/**
 * One task line inside an elevated group card. Ships its states:
 * default, pressed (inline fill), disabled (dimmed press handling),
 * plus the data-driven done and overdue looks.
 */
export function TaskRow({
  task,
  onToggle,
  disabled = false,
  divider = true,
}: {
  task: TaskItem;
  onToggle: (task: TaskItem) => void;
  disabled?: boolean;
  /** Hairline rule under the row, except on a card's last row. */
  divider?: boolean;
}) {
  const done = task.data?.completed != null && task.data.completed !== "";
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  const overdue = !done && due != null && due.date.getTime() < startOfToday();

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onToggle(task)}
      accessibilityLabel={done ? "mark not done" : "mark done"}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        divider && styles.rowDivider,
        pressed && !disabled && styles.rowPressed,
      ]}
    >
      <View style={[styles.circle, done && styles.circleDone]}>
        {done ? <Text style={styles.checkDone}>✓</Text> : null}
      </View>
      <View style={styles.textBlock}>
        <Text
          style={[styles.name, done && styles.nameDone, overdue && !done && styles.nameOverdue]}
          numberOfLines={2}
        >
          {task.name}
        </Text>
        {due && due.hasTime && !done ? (
          <Text style={[styles.time, overdue && styles.timeOverdue]}>
            {formatTime24(due.date)}
          </Text>
        ) : null}
        {overdue && !(due && due.hasTime) && !done ? (
          <Text style={styles.overdueText}>Overdue</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowPressed: {
    backgroundColor: t.colors.surfaceActive,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginRight: t.spacing.md,
  },
  circleDone: {
    backgroundColor: t.colors.accent,
    borderColor: t.colors.accent,
  },
  checkDone: {
    fontSize: 13,
    lineHeight: 14,
    fontWeight: "700",
    color: t.colors.onAccent,
  },
  textBlock: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    lineHeight: 21,
    color: t.colors.text,
    fontFamily: t.fonts.sans,
  },
  nameDone: {
    color: t.colors.textFaint,
    textDecorationLine: "line-through",
  },
  nameOverdue: {
    color: t.colors.textMuted,
  },
  time: {
    fontSize: 13,
    color: t.colors.textMuted,
    fontFamily: t.fonts.mono,
    marginTop: t.spacing.xxs,
  },
  timeOverdue: {
    color: t.colors.danger,
  },
  overdueText: {
    fontSize: 13,
    color: t.colors.danger,
    marginTop: t.spacing.xxs,
  },
});
