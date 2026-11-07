import * as React from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { TaskRow } from "@/components/task-row";
import { CardGroupRow, type CardPosition } from "@/components/ui/card-group-row";
import { colors } from "@/theme/tokens";
import { ReorderGrip, ReorderRow } from "./reorder-row";

type RowView = React.ComponentRef<typeof Animated.View>;

export type TaskCardRowProps = {
  task: TaskItem;
  /** The key of the group the row sits in. The callbacks take it, so
      the row needs no index: an index changes for every row below a
      row that leaves. */
  section: string;
  /** Where the row sits in its card. During a drag, the slot it would
      take. */
  position: CardPosition;
  /** The row is in the Completed group, which recedes. */
  completed: boolean;
  /** My order is on, so the row can be picked up. */
  canDrag: boolean;
  /** The row is the one under the finger. */
  lifted: boolean;
  onToggle: (task: TaskItem) => void;
  onOpen: (task: TaskItem) => void;
  onHold: (
    task: TaskItem,
    section: string,
    e: { pageX: number; pageY: number },
  ) => void;
  onPickup: (task: TaskItem, section: string, x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
  registerRow: (uri: string, node: RowView | null) => void;
  shiftOf: (uri: string) => Animated.Value;
};

/**
 * One row of a group card: the card edges, the reorder gestures, the
 * task row and the grip. It re-renders only when its own task or one
 * of its own values changes. The screen hands every callback one
 * identity, so a tick or a slot crossing re-renders the rows that
 * changed and no other.
 */
function TaskCardRowBase({
  task,
  section,
  position,
  completed,
  canDrag,
  lifted,
  onToggle,
  onOpen,
  onHold,
  onPickup,
  onMove,
  onEnd,
  registerRow,
  shiftOf,
}: TaskCardRowProps) {
  return (
    <CardGroupRow
      ref={(node) => registerRow(task.uri, node)}
      position={position}
      style={[
        completed && styles.completed,
        lifted && styles.slot,
        { transform: [{ translateY: shiftOf(task.uri) }] },
      ]}
    >
      <ReorderRow
        enabled={canDrag}
        onHold={(e) =>
          onHold(task, section, {
            pageX: e.nativeEvent.pageX,
            pageY: e.nativeEvent.pageY,
          })
        }
        onPickup={(x, y) => onPickup(task, section, x, y)}
        onMove={onMove}
        onEnd={onEnd}
      >
        <View style={[styles.main, lifted && styles.hidden]}>
          <TaskRow task={task} onToggle={onToggle} onOpen={onOpen} />
        </View>
      </ReorderRow>
      {canDrag ? (
        <ReorderGrip
          taskName={task.name}
          hidden={lifted}
          onPickup={(x, y) => onPickup(task, section, x, y)}
          onMove={onMove}
          onEnd={onEnd}
        />
      ) : null}
    </CardGroupRow>
  );
}

export const TaskCardRow = React.memo(TaskCardRowBase);

const styles = StyleSheet.create({
  // The grip sits beside the row, so the row keeps its own width.
  main: {
    flex: 1,
  },
  // The reorder: the dragged row hides and its slot draws tinted, so
  // it reads as a place to land rather than an empty task.
  hidden: {
    opacity: 0,
  },
  slot: {
    backgroundColor: colors.accentSoft,
  },
  completed: {
    opacity: 0.55,
  },
});
