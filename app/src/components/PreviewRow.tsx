import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "../features/tasks/query";
import { parseStoredDate } from "../lib/dates";
import { colors, fonts, radii, spacing } from "../theme/tokens";

/**
 * One task as a still picture: the same shape as `TaskRow`, with no
 * touch target, no state and no animation. The pager paints a page
 * with ~20 of these at the start of a gesture, so each must cost
 * about what a plain view costs. The values are copied from
 * `TaskRow`; keep them in step so the preview does not shift when the
 * page becomes live.
 */
function PreviewRowBase({
  task,
  done = false,
  /** "under" puts the time below the name; "right" adds a planner gutter. */
  timeAlign = "under",
}: {
  task: TaskItem;
  /** The task's completed state, read by the caller from its data. */
  done?: boolean;
  timeAlign?: "under" | "right";
}) {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  const overdue = !done && due != null && due.date.getTime() < startOfToday();
  const recurring =
    task.data?.recurrence != null && task.data.recurrence !== "";

  return (
    <View style={styles.row}>
      {timeAlign === "right" && due?.hasTime && !done ? (
        <Text style={[styles.gutterTime, overdue && styles.overdueText]}>
          {formatTime(due.date)}
        </Text>
      ) : null}
      {/* Fixed 24pt circle, empty or filled with the check. */}
      <View style={[styles.circle, done && styles.circleDone]}>
        {done ? <Text style={styles.check}>{"✓"}</Text> : null}
      </View>
      <View style={styles.textBlock}>
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
      </View>
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
    gap: spacing.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.inkFaint,
    alignItems: "center",
    justifyContent: "center",
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
  name: {
    fontSize: 17,
    lineHeight: 24,
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
    // Centered on the 24pt first-line box: (24 - 18) / 2.
    marginTop: 3,
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
 * Still rows are pure over their task and state: a preview re-render
 * must not rebuild every row it shows.
 */
export const PreviewRow = React.memo(PreviewRowBase);
