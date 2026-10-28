import * as React from "react";
import { Pressable, Text, View, type PointerEvent as RNPointerEvent } from "react-native";
import type { TaskItem } from "@/types/task";
import { DropZoneMap } from "@/features/planner/lib/dropzone";
import { formatTime, parseStoredDate } from "@/utils/dates";
import { hourOf, isDone, minuteOf } from "@/features/planner/model";
import { labelHour } from "@/features/planner/lib/labels";
import { Pickup, type DragApi, type LiftState } from "./drag";
import { styles } from "./planner-styles";

/** First and last hour shown by the ruler. */
const RULER_START = 7;
const RULER_END = 22;

/** The hour ruler: hour marks down the left, tasks pinned between. */
export function Timeline({
  tasks,
  isToday,
  now,
  dragActive,
  hoverHour,
  zones,
  lifted,
  onToggle,
  onDragStart,
  api,
  testID,
}: {
  tasks: TaskItem[];
  isToday: boolean;
  now: Date;
  dragActive: boolean;
  hoverHour: number | null;
  /** Rows register under their hour; moves hit-test these rects. */
  zones: DropZoneMap;
  lifted: LiftState;
  onToggle: (task: TaskItem) => void;
  onDragStart: (task: TaskItem, e: RNPointerEvent) => void;
  api?: DragApi;
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
    <View style={styles.ruler}>
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
          children.push(
            <HourTask
              key={task.id}
              task={task}
              lifted={lifted}
              onToggle={onToggle}
              onDragStart={onDragStart}
              api={api}
            />,
          );
        }
        if (isToday && hour === now.getHours() && !placedNow) {
          children.push(<NowLine key="now" />);
        }
        return (
          <View
            key={hour}
            testID={testID == null ? undefined : `${testID}:${hour}`}
            ref={(node) => {
              zones.set(`hour:${hour}`, node);
            }}
            style={[
              styles.rulerRow,
              dragActive && hoverHour === hour && styles.rulerRowHover,
            ]}
          >
            <Text style={styles.rulerMark}>{labelHour(hour)}</Text>
            <View style={styles.rulerSlot}>{children}</View>
          </View>
        );
      })}
    </View>
  );
}

function HourTask({
  task,
  lifted,
  onToggle,
  onDragStart,
  api,
}: {
  task: TaskItem;
  lifted: LiftState;
  onToggle: (task: TaskItem) => void;
  onDragStart: (task: TaskItem, e: RNPointerEvent) => void;
  api?: DragApi;
}) {
  const done = isDone(task);
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  // The chip body is selection only (no-op for now); its circle is
  // the done toggle. Done tasks stay in their slot, struck.
  return (
    <Pickup
      task={task}
      api={api}
      lifted={lifted ?? null}
      onPointerDown={(e) => onDragStart(task, e)}
      style={styles.hourTask}
    >
      <View style={[styles.taskBar, done && styles.taskBarDone]} />
      <Pressable
        style={[styles.tickCircle, done && styles.tickCircleDone]}
        onPress={() => onToggle(task)}
        accessibilityLabel={done ? "mark not done" : "mark done"}
        accessibilityRole="button"
      >
        {done ? <Text style={styles.tickCheck}>{"✓"}</Text> : null}
      </Pressable>
      <View style={styles.taskBody}>
        <Text style={[styles.taskName, done && styles.taskNameDone]} numberOfLines={2}>
          {task.name}
        </Text>
        {due?.hasTime ? (
          <Text style={[styles.taskTime, done && styles.taskTimeDone]}>
            {formatTime(due.date)}
          </Text>
        ) : null}
      </View>
    </Pickup>
  );
}

function NowLine() {
  return (
    <View style={styles.nowLineRow}>
      <View style={styles.nowDot} />
      <View style={styles.nowLine} />
    </View>
  );
}
