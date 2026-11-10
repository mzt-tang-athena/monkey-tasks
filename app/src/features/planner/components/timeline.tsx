import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import type { TaskItem } from "@/types/task";
import { formatTime, parseStoredDate } from "@/utils/dates";
import { hourOf, isDone, minuteOf } from "@/features/planner/model";
import { PlanDrag } from "@/features/planner/lib/plan-drag";
import { labelHour } from "@/features/planner/lib/labels";
import { colors, fonts, radii, radius, spacing } from "@/theme/tokens";
import { usePlannerList } from "./planner-list-context";

/** First and last hour shown by the ruler. */
const RULER_START = 7;
const RULER_END = 22;

/**
 * The hour ruler: hour marks down the left, tasks pinned between. Each
 * hour row is a drop target, and each task is a drag source. A still
 * copy (the swipe preview) draws the same rows with no targets and no
 * sources.
 */
export function Timeline({
  tasks,
  isToday,
  now,
  copy = false,
  testID,
}: {
  tasks: TaskItem[];
  isToday: boolean;
  now: Date;
  /** A still copy: no drop zones and no drag sources. */
  copy?: boolean;
  /** Each hour row's test id is this prefix and its hour, for example
      `timeline-hour:10`. The live day sets it; the swipe preview does
      not, so the id stays unique. */
  testID?: string;
}) {
  const hours: TaskItem[][] = [];
  for (let h = RULER_START; h <= RULER_END; h++) {
    hours[h] = [];
  }
  for (const task of tasks) {
    const hour = hourOf(task);
    if (hour === null) {
      continue;
    }
    const slot = Math.min(Math.max(hour, RULER_START), RULER_END);
    hours[slot].push(task);
  }

  return (
    <View>
      {hours.map((slotTasks, hour) => {
        const children: React.ReactNode[] = [];
        let placedNow = false;
        for (const task of slotTasks) {
          if (
            isToday &&
            hour === now.getHours() &&
            minuteOf(task) > now.getMinutes() &&
            !placedNow
          ) {
            children.push(<NowLine key="now" />);
            placedNow = true;
          }
          children.push(<HourTask key={task.id} task={task} copy={copy} />);
        }
        if (isToday && hour === now.getHours() && !placedNow) {
          children.push(<NowLine key="now" />);
        }
        const row = <>{children}</>;
        const rowTestID = testID == null ? undefined : `${testID}:${hour}`;
        if (copy) {
          return (
            <View key={hour} style={styles.row}>
              <Text style={styles.mark}>{labelHour(hour)}</Text>
              <View style={styles.slot}>{row}</View>
            </View>
          );
        }
        return (
          <PlanDrag.Zone
            key={hour}
            target={{ kind: "hour", hour }}
            testID={rowTestID}
            style={styles.row}
          >
            <Text style={styles.mark}>{labelHour(hour)}</Text>
            <View style={styles.slot}>{row}</View>
          </PlanDrag.Zone>
        );
      })}
    </View>
  );
}

function HourTask({ task, copy }: { task: TaskItem; copy: boolean }) {
  const { toggle } = usePlannerList();
  const done = isDone(task);
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  // The chip body is selection only (no-op for now); its circle is
  // the done toggle. Done tasks stay in their slot, struck.
  const face = (
    <>
      <View style={[styles.bar, done && styles.barDone]} />
      <Pressable
        style={[styles.tick, done && styles.tickDone]}
        onPress={() => toggle(task)}
        accessibilityLabel={done ? "mark not done" : "mark done"}
        accessibilityRole="button"
      >
        {done ? <Text style={styles.tickCheck}>{"✓"}</Text> : null}
      </Pressable>
      <View style={styles.body}>
        <Text style={[styles.name, done && styles.nameDone]} numberOfLines={2}>
          {task.name}
        </Text>
        {due?.hasTime ? (
          <Text style={[styles.time, done && styles.timeDone]}>
            {formatTime(due.date)}
          </Text>
        ) : null}
      </View>
    </>
  );
  if (copy) {
    return <View style={styles.task}>{face}</View>;
  }
  return (
    <PlanDrag.Source
      payload={task}
      hold="row"
      testID={`hour-task:${task.name}`}
      style={styles.task}
    >
      {face}
    </PlanDrag.Source>
  );
}

function NowLine() {
  return (
    <View style={styles.nowRow}>
      <View style={styles.nowDot} />
      <View style={styles.nowLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  mark: {
    width: 56,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
    paddingTop: spacing.xs,
  },
  slot: {
    flex: 1,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  // The circle, the accent bar and the text share one center line.
  task: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.s,
    gap: spacing.s,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
    minHeight: 20,
  },
  barDone: {
    backgroundColor: colors.inkFaint,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  name: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  nameDone: {
    color: colors.inkFaint,
    textDecorationLine: "line-through",
  },
  time: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
  },
  timeDone: {
    color: colors.inkFaint,
  },
  // The chip's own circle is the done toggle.
  tick: {
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.inkFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  tickDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tickCheck: {
    color: colors.onAccent,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "600",
  },
  nowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 18,
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.danger,
    borderRadius: 1,
  },
});
