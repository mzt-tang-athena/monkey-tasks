import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable as PanPressable } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import type { TaskItem } from "@/types/task";
import { useProgress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { taskIsDone } from "@monkey-tasks/schemas";
import { colors } from "@/theme/tokens";
import { NoPanPressable } from "./ui/pressable";
import { faceStyles, TaskRowFace } from "./task-row-face";

/**
 * The live task row: `TaskRowFace` with the toggle, the open press,
 * and the tick. The tick runs on `useProgress`, the one clock React
 * drives. Its completion ends the row's hold (ADR 0034), so no timer
 * runs beside the animation. A row already done at mount plays
 * nothing.
 */
function TaskRowBase({
  task,
  onToggle,
  onOpen,
  onTickSettled,
  grip,
  /** "under" puts the time below the name; "right" adds a planner gutter. */
  timeAlign = "under",
  copy = false,
  /** The row sits inside a drag source: a pan must cancel its press. */
  panPress = false,
}: {
  task: TaskItem;
  onToggle?: (task: TaskItem) => void;
  /** A press on the body opens the task; the circle stays the toggle. */
  onOpen?: (task: TaskItem) => void;
  /** The tick's animation ended, so the row's hold can let go. */
  onTickSettled?: (task: TaskItem) => void;
  /** The reorder handle, when the row can be picked up. */
  grip?: React.ReactNode;
  timeAlign?: "under" | "right";
  /** A still copy of a live row: a swipe preview or a drag ghost. A
      copy carries no test id, so the id finds the live row only. */
  copy?: boolean;
  /** Gesture handler's press, for a row inside a drag source or a
      pager: a pan cancels it, so a drop leaves no click behind. */
  panPress?: boolean;
}) {
  const Press = panPress ? PanPressable : NoPanPressable;
  const [hot, setHot] = React.useState(false);
  // The store is optimistic: a tap flips this row's data in the same
  // frame. The row reads that data and nothing else, so a fast tick,
  // untick, tick sequence has one source of truth.
  const done = task.data != null && taskIsDone(task.data);

  // `active` marks a tick that started after mount. It keeps an untick
  // from playing the tick backwards, and keeps a row that mounts done
  // at rest. It is a shared value, so the commit does not render for it.
  const active = useSharedValue(0);
  const wasDone = React.useRef(done);
  React.useLayoutEffect(() => {
    if (done && !wasDone.current) {
      active.set(1);
    }
    if (!done) {
      active.set(0);
    }
    wasDone.current = done;
  }, [done, active]);

  const tick = useProgress(done, {
    ms: motion.ms.tickWash,
    onSettled: (at) => {
      active.set(0);
      if (at === 1) {
        onTickSettled?.(task);
      }
    },
  });

  // The tick acknowledges the tap; it is not a colour change.
  const pop = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          active.value === 1
            ? 0.9 + 0.1 * Math.min(1, tick.value / 0.375)
            : 1,
      },
    ],
  }));
  const glyph = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          active.value === 1
            ? 0.6 + 0.4 * Math.min(1, tick.value / 0.375)
            : 1,
      },
    ],
  }));
  const wash = useAnimatedStyle(() => ({
    opacity: active.value === 1 ? 0.9 * (1 - tick.value) : 0,
  }));

  const press = () => {
    onToggle?.(task);
  };

  // The circle is the ONLY toggle. It top-anchors to the FIRST text
  // line: 24pt circle on a 24pt line box, so wrapped lines flow
  // beneath without moving it (Google Tasks' rule).
  const toggle = (
    <Animated.View style={pop}>
      <Press
        style={({ pressed }) => [
          faceStyles.circle,
          done && faceStyles.circleDone,
          (hot || pressed) && !done && styles.circleHot,
          pressed && done && styles.circlePressedDone,
        ]}
        onPress={press}
        disabled={onToggle == null}
        hitSlop={11}
        onHoverIn={() => setHot(true)}
        onHoverOut={() => setHot(false)}
        accessibilityLabel={done ? "mark not done" : "mark done"}
        accessibilityRole="button"
        aria-checked={done}
      >
        {/* The glyph travels on its own, so it lands on a circle that
            is already filling rather than riding it. */}
        {done ? (
          <Animated.View style={glyph}>
            <Text style={faceStyles.check}>{"✓"}</Text>
          </Animated.View>
        ) : null}
      </Press>
    </Animated.View>
  );

  // The text beside the circle opens the task when the caller wants
  // that.
  const renderText =
    onOpen == null
      ? undefined
      : (content: React.ReactNode) => (
          <Press
            style={({ pressed }) => [
              faceStyles.text,
              pressed && styles.bodyPressed,
            ]}
            onPress={() => onOpen(task)}
            accessibilityRole="button"
            accessibilityLabel="open task"
          >
            {content}
          </Press>
        );

  return (
    <View
      testID={copy ? undefined : `task-row:${task.name}`}
      style={styles.row}
    >
      <View style={styles.body}>
        <Animated.View
          pointerEvents="none"
          style={[styles.wash, wash]}
        />
        <TaskRowFace
          task={task}
          done={done}
          timeAlign={timeAlign}
          toggle={toggle}
          renderText={renderText}
        />
      </View>
      {grip}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  body: {
    flex: 1,
  },
  wash: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.accentSoft,
  },
  circleHot: {
    backgroundColor: colors.pressed,
  },
  circlePressedDone: {
    opacity: 0.7,
  },
  bodyPressed: {
    opacity: 0.6,
  },
});

/**
 * Rows are pure over their task. A tick replaces one row, so the rest
 * must not re-render; the store keeps every other row's identity.
 */
export const TaskRow = React.memo(TaskRowBase);
