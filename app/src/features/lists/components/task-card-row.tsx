import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { Landing } from "@/components/motion/landing";
import { TaskRow } from "@/components/task-row";
import { ListReorder } from "../lib/list-reorder";

export type TaskCardRowProps = {
  task: TaskItem;
  /** The key of the group the row sits in. */
  section: string;
  /** The row's place in its group, and the group's size. The reorder
      surface reads both for its slot math and the card corners. */
  index: number;
  count: number;
  /** The row is in the Completed group, which recedes. */
  completed: boolean;
  /** My order is on, so the row can be picked up. */
  canDrag: boolean;
  onToggle: (task: TaskItem) => void;
  onOpen: (task: TaskItem) => void;
  /** The tick's animation ended, so the row's hold can let go. */
  onTickSettled: (task: TaskItem) => void;
};

/**
 * One row of a group card: the card edges, the reorder gesture, the
 * task row and its grip. The reorder surface owns the transform, the
 * corners and the divider, so a slot crossing re-renders nothing here.
 * The row still re-renders only when its own task or values change.
 */
function TaskCardRowBase({
  task,
  section,
  index,
  count,
  completed,
  canDrag,
  onToggle,
  onOpen,
  onTickSettled,
}: TaskCardRowProps) {
  // One grip element for the row's life: a new element on every render
  // would re-render the memoized row below it.
  const grip = React.useMemo(
    () =>
      canDrag ? (
        <ListReorder.Grip testID={`reorder-grip:${task.name}`} />
      ) : null,
    [canDrag, task.name],
  );
  return (
    <View style={[styles.slot, completed && styles.completed]}>
      <ListReorder.Item
        payload={task}
        id={task.uri}
        group={section}
        index={index}
        count={count}
        disabled={!canDrag}
        testID={`reorder-item:${task.name}`}
      >
        <View style={styles.main}>
          <Landing id={task.uri}>
            <TaskRow
              task={task}
              onToggle={onToggle}
              onOpen={onOpen}
              onTickSettled={onTickSettled}
              panPress
              grip={grip}
            />
          </Landing>
        </View>
      </ListReorder.Item>
    </View>
  );
}

export const TaskCardRow = React.memo(TaskCardRowBase);

const styles = StyleSheet.create({
  slot: {
    flex: 1,
  },
  main: {
    flex: 1,
  },
  completed: {
    opacity: 0.55,
  },
});
