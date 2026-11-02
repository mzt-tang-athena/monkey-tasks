import * as React from "react";
import { Animated, Platform, Pressable, StyleSheet, Text } from "react-native";
import type { TaskItem } from "@/types/task";
import { parseStoredDate } from "@/utils/dates";
import { easeOut, useReduceMotion, useRise } from "@/lib/motion";
import { taskIsDone } from "@monkey-tasks/schemas";
import { colors } from "@/theme/tokens";
import { faceStyles, TaskRowFace } from "./task-row-face";

/**
 * The live task row: `TaskRowFace` with the toggle, the open press,
 * and today's motion (the tick, the wash and the landing).
 */
function TaskRowBase({
  task,
  onToggle,
  onOpen,
  /** "under" puts the time below the name; "right" adds a planner gutter. */
  timeAlign = "under",
  copy = false,
}: {
  task: TaskItem;
  onToggle?: (task: TaskItem) => void;
  /** A press on the body opens the task; the circle stays the toggle. */
  onOpen?: (task: TaskItem) => void;
  timeAlign?: "under" | "right";
  /** A still copy of a live row: a swipe preview or a drag ghost. A
      copy carries no test id, so the id finds the live row only. */
  copy?: boolean;
}) {
  const [hot, setHot] = React.useState(false);
  // The store is optimistic: a tap flips this row's data in the same
  // frame. The row reads that data and nothing else, so a fast tick,
  // untick, tick sequence has one source of truth.
  const done = task.data != null && taskIsDone(task.data);
  const reduced = useReduceMotion();

  // The tick is an acknowledgement, not a colour change: the circle
  // fills, the check pops in over it, and a wash crosses the row once.
  // The circle and the glyph travel apart, so the check lands on a
  // surface that is already settling.
  const [pop] = React.useState(() => new Animated.Value(1));
  const [glyph] = React.useState(() => new Animated.Value(1));
  // One wash serves both acknowledgements: the tick and the landing of
  // a capture. They never run together on the same row for long, and
  // sharing the layer keeps a single cheap animated view.
  const [wash] = React.useState(() => new Animated.Value(0));

  // A row created moments ago rises in where it will live instead of
  // appearing under the finger. The fade is the app's shared entrance;
  // the travel is a touch longer, which reads as the row settling.
  const rise = useRise(task.data?.created);
  // The entrance helper owns the freshness window and does not export
  // it: a landing needs the same gate to know whether it travels and
  // washes at all.
  const [fresh] = React.useState(() => {
    const at = task.data?.created ? parseStoredDate(task.data.created) : null;
    return at != null && Date.now() - at.date.getTime() < freshMs;
  });
  const [land] = React.useState(() => new Animated.Value(fresh ? 0 : 1));

  // A row that is already done at mount is not a tick. Every later
  // change plays, or lands at once when motion is reduced.
  const played = React.useRef(false);
  React.useEffect(() => {
    if (!played.current) {
      played.current = true;
      return;
    }
    if (reduced || !done) {
      settle(pop, 1);
      settle(glyph, 1);
      settle(wash, 0);
      return;
    }
    play(pop, 1, 120);
    play(glyph, 1, 120);
    play(wash, 0, 320);
  }, [done, reduced, pop, glyph, wash]);

  // A captured task lands with a visible rise and the same wash, so
  // the new row is seen arriving rather than found in the list.
  React.useEffect(() => {
    if (!fresh) {
      return;
    }
    if (reduced) {
      settle(land, 1);
      settle(wash, 0);
      return;
    }
    settle(wash, 0.9);
    play(land, 1, 220);
    play(wash, 0, 600);
  }, [fresh, reduced, land, wash]);

  const press = () => {
    if (onToggle == null) {
      return;
    }
    // The press puts the values where the animation starts, before the
    // data flips, so the first frame of the tick never shows the end
    // state. The effect above then plays them out.
    const next = !done;
    settle(pop, next && !reduced ? 0.9 : 1);
    settle(glyph, next && !reduced ? 0.6 : 1);
    settle(wash, next && !reduced ? 0.9 : 0);
    onToggle(task);
  };

  // The circle is the ONLY toggle. It top-anchors to the FIRST text
  // line: 24pt circle on a 24pt line box, so wrapped lines flow
  // beneath without moving it (Google Tasks' rule).
  const toggle = (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <Pressable
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
          <Animated.View style={{ transform: [{ scale: glyph }] }}>
            <Text style={faceStyles.check}>{"✓"}</Text>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );

  // The text beside the circle opens the task when the caller wants
  // that.
  const renderText =
    onOpen == null
      ? undefined
      : (content: React.ReactNode) => (
          <Pressable
            style={({ pressed }) => [
              faceStyles.text,
              pressed && styles.bodyPressed,
            ]}
            onPress={() => onOpen(task)}
            accessibilityRole="button"
            accessibilityLabel="open task"
          >
            {content}
          </Pressable>
        );

  return (
    <Animated.View
      testID={copy ? undefined : `task-row:${task.name}`}
      style={{
        opacity: rise,
        transform: [
          {
            translateY: land.interpolate({
              inputRange: [0, 1],
              outputRange: [landingPx, 0],
            }),
          },
        ],
      }}
    >
      {/* The acknowledgement sits behind the content and never takes a
          touch: a tick and a landing both show the same accent wash. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.wash, { opacity: wash }]}
      />
      <TaskRowFace
        task={task}
        done={done}
        timeAlign={timeAlign}
        toggle={toggle}
        renderText={renderText}
      />
    </Animated.View>
  );
}

/** How far a capture travels as it lands. */
const landingPx = 12;

/** The freshness window the entrance helper uses, kept in step with
    it: a landing must not outlive the rise it belongs to. */
const freshMs = 90_000;

/** Put a value at its end state, stopping whatever was playing. */
function settle(value: Animated.Value, toValue: number) {
  value.stopAnimation();
  value.setValue(toValue);
}

/** Travel on the app's entrance curve. */
function play(value: Animated.Value, toValue: number, duration: number) {
  Animated.timing(value, {
    toValue,
    duration,
    easing: easeOut,
    useNativeDriver: Platform.OS !== "web",
  }).start();
}

const styles = StyleSheet.create({
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
