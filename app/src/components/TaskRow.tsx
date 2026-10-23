import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "../features/tasks/query";
import { parseStoredDate } from "../lib/dates";
import { taskIsDone } from "@monkey-tasks/schemas";
import { colors, fonts, spacing, radii } from "../theme/tokens";

function TaskRowBase({
  task,
  onToggle,
  onOpen,
  /** "under" puts the time below the name; "right" adds a planner gutter. */
  timeAlign = "under",
}: {
  task: TaskItem;
  onToggle?: (task: TaskItem) => void;
  /** A press on the body opens the task; the circle stays the toggle. */
  onOpen?: (task: TaskItem) => void;
  timeAlign?: "under" | "right";
}) {
  const [hot, setHot] = React.useState(false);
  const done = task.data != null && taskIsDone(task.data);
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  const overdue =
    !done && due != null && due.date.getTime() < startOfToday();
  const recurring = task.data?.recurrence != null && task.data.recurrence !== "";
  const disabled = onToggle == null;

  const body = (
    <>
      <Text style={[styles.name, done && styles.nameDone]} numberOfLines={2}>
        {task.name}
      </Text>
      <View style={styles.metaRow}>
        {timeAlign === "under" && due?.hasTime && !done ? (
          <Text style={[styles.time, overdue && styles.overdueText]}>
            {formatTime(due.date)}
          </Text>
        ) : null}
        {!due && task.data?.due ? (
          <Text style={[styles.badDate, overdue && styles.overdueText]}>
            bad date
          </Text>
        ) : null}
        {recurring ? <Text style={styles.recur}>repeats</Text> : null}
        {overdue ? <Text style={styles.overdueText}>overdue</Text> : null}
      </View>
    </>
  );

  return (
    <View style={styles.row}>
      {timeAlign === "right" && due?.hasTime && !done ? (
        <Text style={[styles.gutterTime, overdue && styles.overdueText]}>
          {formatTime(due.date)}
        </Text>
      ) : null}
      {/* The circle is the ONLY toggle. It top-anchors to the FIRST
          text line: 22pt circle on a 22pt line box, so wrapped lines
          flow beneath without moving it (Google Tasks' rule). The
          body beside it opens the task when the caller wants that. */}
      <Pressable
        style={({ pressed }) => [
          styles.circle,
          done && styles.circleDone,
          (hot || pressed) && !done && styles.circleHot,
          pressed && done && styles.circlePressedDone,
        ]}
        onPress={onToggle ? () => onToggle(task) : undefined}
        disabled={disabled}
        hitSlop={11}
        onHoverIn={() => setHot(true)}
        onHoverOut={() => setHot(false)}
        accessibilityLabel={done ? "mark not done" : "mark done"}
        accessibilityRole="button"
        accessibilityState={{ checked: done }}
      >
        {done ? <Text style={styles.check}>{"✓"}</Text> : null}
      </Pressable>

      {onOpen == null ? (
        <View style={styles.textBlock}>{body}</View>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.textBlock,
            pressed && styles.bodyPressed,
          ]}
          onPress={() => onOpen(task)}
          accessibilityRole="button"
          accessibilityLabel="open task"
        >
          {body}
        </Pressable>
      )}
    </View>
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
    // The circle top-anchors to the first text line; the block below
    // may wrap or grow without moving it. The row hugs its content,
    // so single-line tasks sit exactly centered.
    alignItems: "flex-start",
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  circleHot: {
    backgroundColor: colors.pressed,
  },
  circlePressedDone: {
    opacity: 0.7,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
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
    fontSize: 13,
    lineHeight: 14,
    fontWeight: "600",
  },
  textBlock: {
    flex: 1,
  },
  bodyPressed: {
    opacity: 0.6,
  },
  name: {
    fontSize: 16,
    lineHeight: 22,
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
  badDate: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.danger,
  },
  time: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  gutterTime: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    width: 64,
    fontVariant: ["tabular-nums"],
    // Centered on the 22pt first-line box: (22 - 18) / 2.
    marginTop: 2,
  },
  recur: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.accent,
  },
  overdueText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.danger,
  },
});

/**
 * Rows are pure over their task. A tick replaces one row, so the rest
 * must not re-render; the store keeps every other row's identity.
 */
export const TaskRow = React.memo(TaskRowBase);
