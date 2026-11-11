import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { Landing } from "@/components/motion/landing";
import { TaskRow } from "@/components/task-row";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ListReorder } from "../lib/list-reorder";

/** The four moves a row offers without a drag. */
export type RowMove = "up" | "down" | "top" | "bottom";

export type TaskCardRowProps = {
  task: TaskItem;
  /** The key of the group the row sits in. */
  section: string;
  /** The row's place in its group, and the group's size. The reorder
      surface reads both for its slot math and the card corners. */
  index: number;
  count: number;
  /** Move the row through the same reorder path a drop writes. */
  onMove: (task: TaskItem, section: string, from: number, to: number) => void;
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
  onMove,
  onToggle,
  onOpen,
  onTickSettled,
}: TaskCardRowProps) {
  // The actions menu reads the row's place when it opens, so a slot
  // crossing does not rebuild the grip element and re-render the row.
  const place = React.useRef({ index, count });
  React.useLayoutEffect(() => {
    place.current = { index, count };
  }, [index, count]);
  const move = React.useCallback(
    (action: RowMove) => {
      const at = place.current;
      const to =
        action === "up"
          ? at.index - 1
          : action === "down"
            ? at.index + 2
            : action === "top"
              ? 0
              : at.count;
      onMove(task, section, at.index, to);
    },
    [onMove, task, section],
  );
  const grip = React.useMemo(
    () =>
      canDrag ? (
        <>
          <RowActions task={task} place={place} onMove={move} />
          <ListReorder.Grip testID={`reorder-grip:${task.name}`} />
        </>
      ) : null,
    [canDrag, task, move],
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
              grip={grip}
            />
          </Landing>
        </View>
      </ListReorder.Item>
    </View>
  );
}

export const TaskCardRow = React.memo(TaskCardRowBase);

/**
 * The non-drag path for a row in My order: a menu that moves it up,
 * down, to the top or to the bottom. Each move writes through the
 * reorder the surface's drop writes.
 */
function RowActions({
  task,
  place,
  onMove,
}: {
  task: TaskItem;
  place: React.RefObject<{ index: number; count: number }>;
  onMove: (action: RowMove) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const anchor = React.useRef<React.ComponentRef<typeof View>>(null);
  const { index, count } = place.current;
  const move = (action: RowMove) => {
    setOpen(false);
    onMove(action);
  };
  const items: MenuItem[] = [
    { key: "up", label: "Move up", disabled: index === 0, onPress: () => move("up") },
    {
      key: "down",
      label: "Move down",
      disabled: index >= count - 1,
      onPress: () => move("down"),
    },
    { key: "top", label: "Move to top", disabled: index === 0, onPress: () => move("top") },
    {
      key: "bottom",
      label: "Move to bottom",
      disabled: index >= count - 1,
      onPress: () => move("bottom"),
    },
  ];
  const label = `actions for ${task.name}`;
  return (
    <View ref={anchor}>
      <IconButton
        label={label}
        expanded={open}
        onPress={() => setOpen((shown) => !shown)}
      >
        <Icon name="more" />
      </IconButton>
      <Menu
        open={open}
        anchor={anchor}
        onClose={() => setOpen(false)}
        label={label}
        items={items}
      />
    </View>
  );
}

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
