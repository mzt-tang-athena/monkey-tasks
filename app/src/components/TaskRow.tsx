import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "../features/tasks/query";
import { parseStoredDate } from "../lib/dates";
import { colors, fonts, spacing } from "../theme/tokens";

/**
 * Variant E task row: dense and quiet. A 20pt circle, one 15pt line
 * of text, tight 44pt minimum height. Separators come from the list,
 * not the row.
 */
export function TaskRow({
  task,
  onToggle,
  /** "under" puts the time below the name; "right" adds a planner gutter. */
  timeAlign = "under",
}: {
  task: TaskItem;
  onToggle?: (task: TaskItem) => void;
  timeAlign?: "under" | "right";
}) {
  const [pressed, setPressed] = React.useState(false);
  const done = task.data?.completed != null && task.data.completed !== "";
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  const overdue =
    !done && due != null && due.date.getTime() < startOfToday();
  const recurring = task.data?.recurrence != null && task.data.recurrence !== "";
  const disabled = onToggle == null;

  return (
    <Pressable
      style={[
        styles.row,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
      onPress={onToggle ? () => onToggle(task) : undefined}
      disabled={disabled}
      onHoverIn={() => setPressed(true)}
      onHoverOut={() => setPressed(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={done ? "mark not done" : "mark done"}
      accessibilityRole="button"
    >
      {timeAlign === "right" && due?.hasTime && !done ? (
        <Text style={[styles.gutterTime, overdue && styles.overdueText]}>
          {formatTime(due.date)}
        </Text>
      ) : null}
      {/* The circle is visual only; the whole row is the toggle target. */}
      <View style={[styles.circle, done && styles.circleDone]}>
        {done ? <Text style={styles.check}>{"✓"}</Text> : null}
      </View>

      <View style={styles.textBlock}>
        <Text
          style={[styles.name, done && styles.nameDone]}
          numberOfLines={2}
        >
          {task.name}
        </Text>
        <View style={styles.metaRow}>
          {timeAlign === "under" && due?.hasTime && !done ? (
            <Text style={[styles.time, overdue && styles.overdueText]}>
              {formatTime(due.date)}
            </Text>
          ) : null}
          {recurring ? <Text style={styles.recur}>repeats</Text> : null}
          {overdue ? <Text style={styles.overdueText}>overdue</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${h}:${String(date.getMinutes()).padStart(2, "0")} ${ampm}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  rowPressed: {
    backgroundColor: colors.pressed,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.inkFaint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.m,
  },
  circleDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  check: {
    color: colors.onAccent,
    fontSize: 12,
    lineHeight: 13,
    fontWeight: "600",
  },
  textBlock: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  nameDone: {
    color: colors.inkFaint,
    textDecorationLine: "line-through",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    marginTop: 2,
  },
  time: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  gutterTime: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    width: 60,
    fontVariant: ["tabular-nums"],
  },
  recur: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.accent,
  },
  overdueText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.danger,
  },
});
