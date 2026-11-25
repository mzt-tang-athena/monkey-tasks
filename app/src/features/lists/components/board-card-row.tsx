import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { Landing } from "@/components/motion/landing";
import { TaskRow } from "@/components/task-row";
import { spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { BoardReorder, type BoardCard } from "../lib/board-reorder";
import type { BoardSection } from "../lib/board";

export type BoardCardRowProps = {
  task: TaskItem;
  /** The status group the card sits in. */
  section: BoardSection;
  index: number;
  count: number;
  /** My order is on, so the card can be picked up. */
  canDrag: boolean;
  /** The deed's first open blocker, or null. */
  blockedBy: string | null;
  onToggle: (task: TaskItem) => void;
  onOpen: (task: TaskItem) => void;
  onTickSettled: (task: TaskItem) => void;
};

/**
 * One card on the board: the card edge, the reorder gesture, the task
 * row and its grip. A blocked deed adds the danger rail at its left
 * edge and keeps its drag, because readiness only changes how it looks.
 */
function BoardCardRowBase({
  task,
  section,
  index,
  count,
  canDrag,
  blockedBy,
  onToggle,
  onOpen,
  onTickSettled,
}: BoardCardRowProps) {
  const { styles } = useThemedStyles(makeStyles);
  const grip = React.useMemo(
    () =>
      canDrag ? (
        <BoardReorder.Grip
          testID={`board-grip:${task.name}`}
          label={`reorder ${task.name}`}
        />
      ) : null,
    [canDrag, task.name],
  );
  const payload = React.useMemo<BoardCard>(
    () => ({ task, status: section.status }),
    [task, section.status],
  );
  return (
    <View style={styles.slot}>
      <BoardReorder.Item
        payload={payload}
        id={task.uri}
        group={section.status}
        index={index}
        count={count}
        disabled={!canDrag}
        testID={`board-card:${task.name}`}
      >
        <View style={styles.main}>
          <Landing id={task.uri}>
            <View style={styles.card}>
              {blockedBy == null ? null : (
                <View
                  testID={`blocked-rail:${task.name}`}
                  pointerEvents="none"
                  style={styles.rail}
                />
              )}
              <TaskRow
                task={task}
                onToggle={onToggle}
                onOpen={onOpen}
                onTickSettled={onTickSettled}
                grip={grip}
                blockedBy={blockedBy}
              />
            </View>
          </Landing>
        </View>
      </BoardReorder.Item>
    </View>
  );
}

export const BoardCardRow = React.memo(BoardCardRowBase);

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    slot: {
      flex: 1,
    },
    main: {
      flex: 1,
    },
    // The card's own frame, so the rail can sit at its edge.
    card: {
      position: "relative",
    },
    rail: {
      position: "absolute",
      left: 0,
      top: spacing.s,
      bottom: spacing.s,
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.danger,
      zIndex: 1,
    },
  }),
});
