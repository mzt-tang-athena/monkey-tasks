import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { formatTime, parseStoredDate, startOfToday } from "@/utils/dates";
import { fonts, radii, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** The toggle circle's size. */
const circle = 24;

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
  circle,
  /** The planner's time gutter, left of the circle. */
  gutter: 64,
  /** From the row's left edge to its text when the time sits under
      the name. A card divider starts here. */
  textInset: spacing.l + circle + spacing.m,
} as const;

/**
 * The row body's name: the task and its meta, for example
 * "Buy milk, 3:00 PM, overdue". The meta line is hidden from assistive
 * tech, so this name is the one a reader hears.
 */
export function taskRowLabel(task: TaskItem, done: boolean): string {
  const meta = taskMeta(task, done);
  return [
    task.name,
    meta.time,
    meta.badDate ? "bad date" : null,
    meta.recurring ? "repeats" : null,
    meta.overdue ? "overdue" : null,
  ]
    .filter((part): part is string => part != null && part !== "")
    .join(", ");
}

/** The meta line's parts: the time, a bad date, repeats, overdue. */
export function taskMeta(task: TaskItem, done: boolean) {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  return {
    time: due?.hasTime === true && !done ? formatTime(due.date) : null,
    badDate: due == null && Boolean(task.data?.due),
    recurring: task.data?.recurrence != null && task.data.recurrence !== "",
    overdue: !done && due != null && due.date.getTime() < startOfToday(),
  };
}

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
  const { faceStyles, styles } = useThemedStyles(makeStyles);
  const meta = taskMeta(task, done);
  const { badDate, recurring, overdue } = meta;
  const time = meta.time;
  const timeUnder = timeAlign === "under" && time != null;
  // The meta line shows only when it holds something. An empty one
  // would add its gap under every single-line row (ADR 0012).
  const hasMeta = timeUnder || badDate || recurring || overdue;

  // A non-breaking space joins the meta words in the button's name. The
  // flex gap draws the space on screen but leaves no text for the name.
  const content = (
    <>
      <Text style={[styles.name, done && styles.nameDone]} numberOfLines={2}>
        {task.name}
      </Text>
      {hasMeta ? (
        <View style={styles.metaRow} aria-hidden>
          {timeUnder ? (
            <Text style={[styles.time, overdue && styles.overdueText]}>
              {`\u00a0${time}`}
            </Text>
          ) : null}
          {badDate ? <Text style={styles.badDate}>{"\u00a0bad date"}</Text> : null}
          {recurring ? <Text style={styles.recur}>{"\u00a0repeats"}</Text> : null}
          {overdue ? <Text style={styles.overdueText}>{"\u00a0overdue"}</Text> : null}
        </View>
      ) : null}
    </>
  );

  // A live row's text target owns the vertical padding, so its press box
  // reaches 44 without growing the row. The circle's slot takes the same
  // top padding, so the mark still sits on the first text line.
  const live = renderText != null;
  return (
    <View style={[styles.row, live && styles.rowLive]}>
      {timeAlign === "right" && time != null ? (
        <Text
          style={[
            styles.gutterTime,
            live && styles.gutterTimeLive,
            overdue && styles.overdueText,
          ]}
        >
          {time}
        </Text>
      ) : null}
      <View style={live ? styles.toggleLive : undefined}>
        {toggle ?? (
          <View style={[faceStyles.circle, done && faceStyles.circleDone]}>
            {done ? <Text style={faceStyles.check}>{"✓"}</Text> : null}
          </View>
        )}
      </View>
      {renderText == null ? (
        <View style={faceStyles.text}>{content}</View>
      ) : (
        renderText(content)
      )}
    </View>
  );
}

/**
 * The face's height, in px, for a name that draws `lines` lines. The
 * list preview uses it to stop drawing rows before the viewport ends.
 */
export function taskFaceHeight(
  task: TaskItem,
  lines = 1,
  timeAlign: "under" | "right" = "under",
): number {
  const done = task.data?.completed != null;
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  const overdue = !done && due != null && due.date.getTime() < startOfToday();
  const recurring = task.data?.recurrence != null && task.data.recurrence !== "";
  const timeUnder = timeAlign === "under" && !done && due?.hasTime === true;
  const badDate = due == null && Boolean(task.data?.due);
  const meta = timeUnder || badDate || recurring || overdue;
  return (
    taskRowFace.padY * 2 +
    24 * Math.min(Math.max(lines, 1), 2) +
    (meta ? 20 : 0)
  );
}

/** The parts a live row rebuilds with its own handlers and motion. */
/** The face sheets for the active palette, shared with the live row. */
export function useTaskRowFace() {
  return useThemedStyles(makeStyles);
}

const makeStyles = (colors: Palette) => ({
  faceStyles: StyleSheet.create({
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
  }),
  styles: StyleSheet.create({
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
    // The press target inside a live row carries the vertical padding.
    rowLive: {
      paddingVertical: 0,
    },
    toggleLive: {
      paddingTop: taskRowFace.padY,
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
    // Live rows lift the row's padding into the text target, so the
    // gutter time centers on the same first line from the row's top.
    gutterTimeLive: {
      paddingVertical: 0,
      paddingTop: taskRowFace.padY + 3,
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
  }),
});

