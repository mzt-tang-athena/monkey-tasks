import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { formatTime, parseStoredDate, startOfToday } from "@/utils/dates";
import { colors, fonts, radii, spacing } from "@/theme/tokens";

/**
 * The task row's layout. The live row, the still preview row and the
 * card around them all read these numbers, so a change here moves
 * every copy together.
 */
export const taskRowFace = {
  /** Side padding inside the row. */
  padX: spacing.l,
  /** Top and bottom padding inside the row: the same on both sides. */
  padY: spacing.m,
  /** Space between the gutter time, the circle and the text. */
  gap: spacing.m,
  /** The toggle circle, and the first text line it sits on. */
  circle: 24,
  /** The planner's time gutter, left of the circle. */
  gutter: 64,
  /** From the row's left edge to its text when the time sits under
      the name. A card divider starts here. */
  textInset: spacing.l + 24 + spacing.m,
} as const;

/**
 * One task as still markup: the gutter time, the circle and the text.
 * It holds no state, no handler and no motion. `TaskRow` passes its
 * own toggle and wraps the text in a press target. `PreviewRow` uses
 * the face as it is.
 */
export function TaskRowFace({
  task,
  done,
  timeAlign = "under",
  toggle,
  renderText,
}: {
  task: TaskItem;
  done: boolean;
  /** "under" puts the time below the name; "right" adds a planner gutter. */
  timeAlign?: "under" | "right";
  /** The live row's toggle. Without one, the face draws a still circle. */
  toggle?: React.ReactNode;
  /** Wraps the text, so the live row can make it a press target. The
      wrapper must carry `faceStyles.text`. */
  renderText?: (content: React.ReactNode) => React.ReactNode;
}) {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  const overdue = !done && due != null && due.date.getTime() < startOfToday();
  const recurring =
    task.data?.recurrence != null && task.data.recurrence !== "";
  const time = due?.hasTime && !done ? formatTime(due.date) : null;
  const timeUnder = timeAlign === "under" && time != null;
  const badDate = due == null && Boolean(task.data?.due);
  // The meta line shows only when it holds something. An empty one
  // would add its gap under every single-line row (ADR 0012).
  const meta = timeUnder || badDate || recurring || overdue;

  const content = (
    <>
      <Text style={[styles.name, done && styles.nameDone]} numberOfLines={2}>
        {task.name}
      </Text>
      {meta ? (
        <View style={styles.metaRow}>
          {timeUnder ? (
            <Text style={[styles.time, overdue && styles.overdueText]}>
              {time}
            </Text>
          ) : null}
          {badDate ? <Text style={styles.badDate}>bad date</Text> : null}
          {recurring ? <Text style={styles.recur}>repeats</Text> : null}
          {overdue ? <Text style={styles.overdueText}>overdue</Text> : null}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={styles.row}>
      {timeAlign === "right" && time != null ? (
        <Text style={[styles.gutterTime, overdue && styles.overdueText]}>
          {time}
        </Text>
      ) : null}
      {toggle ?? (
        <View style={[faceStyles.circle, done && faceStyles.circleDone]}>
          {done ? <Text style={faceStyles.check}>{"✓"}</Text> : null}
        </View>
      )}
      {renderText == null ? (
        <View style={faceStyles.text}>{content}</View>
      ) : (
        renderText(content)
      )}
    </View>
  );
}

/** The parts a live row rebuilds with its own handlers and motion. */
export const faceStyles = StyleSheet.create({
  circle: {
    width: taskRowFace.circle,
    height: taskRowFace.circle,
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
  // The text owns the gap between the name and the meta line.
  text: {
    flex: 1,
    gap: 2,
  },
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    // The circle top-anchors to the first text line; the block below
    // may wrap or grow without moving it. The row hugs its content,
    // so single-line tasks sit exactly centered.
    alignItems: "flex-start",
    gap: taskRowFace.gap,
    paddingHorizontal: taskRowFace.padX,
    paddingVertical: taskRowFace.padY,
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
    width: taskRowFace.gutter,
    fontVariant: ["tabular-nums"],
    // Centered on the 24pt first-line box: (24 - 18) / 2 on each side.
    paddingVertical: 3,
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
