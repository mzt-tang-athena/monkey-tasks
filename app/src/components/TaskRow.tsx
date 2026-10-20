import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "../features/tasks/query";
import { parseStoredDate } from "../lib/dates";

export function TaskRow({
  task,
  onToggle,
}: {
  task: TaskItem;
  onToggle: (task: TaskItem) => void;
}) {
  const done = task.data?.completed != null && task.data.completed !== "";
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  const overdue =
    !done && due != null && due.date.getTime() < startOfToday();
  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.circle, done && styles.circleDone]}
        onPress={() => onToggle(task)}
        accessibilityLabel={done ? "mark not done" : "mark done"}
      />
      <View style={styles.textBlock}>
        <Text style={[styles.name, done && styles.nameDone]} numberOfLines={2}>
          {task.name}
        </Text>
        {due && due.hasTime && !done ? (
          <Text style={[styles.time, overdue && styles.overdueText]}>
            {formatTime(due.date)}
          </Text>
        ) : null}
        {overdue ? <Text style={styles.overdueText}>Overdue</Text> : null}
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
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#777777",
    marginRight: 12,
  },
  circleDone: {
    backgroundColor: "#333333",
    borderColor: "#333333",
  },
  textBlock: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    color: "#111111",
  },
  nameDone: {
    color: "#999999",
    textDecorationLine: "line-through",
  },
  time: {
    fontSize: 13,
    color: "#444444",
    marginTop: 2,
  },
  overdueText: {
    fontSize: 13,
    color: "#b3261e",
    marginTop: 2,
  },
});
