/* eslint-disable react-hooks/refs */
import * as React from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type PointerEvent as RNPointerEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useRise, useShake } from "../../../lib/motion";
import { colors, drag } from "../../../theme/tokens";
import type { TaskItem } from "../../tasks/query";

/* -------------------------------------------------------- interaction */

export type LiftState = { task: TaskItem; phase: "hold" | "picked" } | null;

/** Rows carry the lift: a quiet tint through the hold, then a
    scale-plus-shadow pickup once the drag owns the pointer. Empty
    when no drag concerns this row. */
export function liftStyleOf(
  lifted: LiftState,
  task: TaskItem,
): (typeof styles.liftHold | typeof styles.liftPicked)[] {
  if (lifted == null || lifted.task.uri !== task.uri) {
    return [];
  }
  return [lifted.phase === "hold" ? styles.liftHold : styles.liftPicked];
}

/**
 * The readiness shake: once the hold completes and the drag is armed,
 * the source shakes once so the finger knows the row is picked up.
 */
function useLiftShake(lift: LiftState, task: TaskItem): Animated.Value {
  const { offset, start } = useShake();
  const picked =
    lift != null && lift.task.uri === task.uri && lift.phase === "picked";
  React.useEffect(() => {
    if (picked) {
      start();
    }
  }, [picked, start]);
  return offset;
}

/** The interaction layer's split: web reads the W3C pointer events
    straight from React Native; Android gates those off, so its drag
    sources ride the gesture library instead. */
export const pointerPickup = Platform.OS === "web";

/** The contract a screen's drag machinery exposes to its sources:
    pickup, move with the drop-zone hit-test, and the drop write. */
export type DragApi = {
  /** The finger landed: show the hold cue and arm it after the delay. */
  hold?: (task: TaskItem, kind: "pill" | "row") => void;
  /** The finger left without a drag: clear the hold cue. */
  releaseHold?: () => void;
  pickup: (task: TaskItem, x: number, y: number, kind: "pill" | "row") => void;
  move: (x: number, y: number) => void;
  drop: () => void;
};

/** One drag source on native: the Pan activates after the hold, so
    pane scrolling keeps every gesture that moves too early. */
export function NativeDragHandle({
  task,
  kind = "row",
  api,
  lift,
  style,
  children,
}: {
  task: TaskItem;
  kind?: "pill" | "row";
  api: DragApi;
  lift?: LiftState;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const hold = kind === "pill" ? drag.pillPickMs : drag.pickMs;
  // The pan's own flag: onEnd is the one drop, onFinalize the reset.
  const active = React.useRef(false);
  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        // The callbacks touch plain JS state and the store, so they
        // must stay on the JS thread, not the UI runtime.
        .runOnJS(true)
        .activateAfterLongPress(hold)
        // The cue starts on touch down, not on activation: the hold is
        // visible while it runs.
        .onBegin(() => {
          api.hold?.(task, kind);
        })
        .onStart((e) => {
          active.current = true;
          api.pickup(task, e.absoluteX, e.absoluteY, kind);
        })
        .onUpdate((e) => {
          api.move(e.absoluteX, e.absoluteY);
        })
        .onEnd(() => {
          active.current = false;
          api.drop();
        })
        .onFinalize(() => {
          // A cancelled pan finalizes without an end, so clear the
          // drag it left behind. An ended pan already dropped.
          if (active.current) {
            active.current = false;
            api.drop();
          }
          api.releaseHold?.();
        }),
    [task, kind, hold, api],
  );
  const shakeX = useLiftShake(lift ?? null, task);
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
        <View style={[style, ...liftStyleOf(lift ?? null, task)]}>
          {children}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** A drag source's wrapper: the pointer contract on web, the gesture
    library on native. One call site, both platforms. */
export function Pickup({
  task,
  kind = "row",
  api,
  lifted,
  onPointerDown,
  style,
  children,
}: {
  task: TaskItem;
  kind?: "pill" | "row";
  api?: DragApi;
  lifted?: LiftState;
  onPointerDown?: (e: RNPointerEvent) => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const shakeX = useLiftShake(lifted ?? null, task);
  // A pill that just landed rises in; a row is handled by TaskRow, so
  // passing it here too would animate it twice.
  const rise = useRise(kind === "pill" ? task.data?.created : undefined);
  const riseStyle = {
    opacity: rise,
    transform: [
      {
        translateY: rise.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  };
  if (pointerPickup || api == null) {
    return (
      <Animated.View
        style={[riseStyle, { transform: [...riseStyle.transform, { translateX: shakeX }] }]}
      >
        <View
          style={[style, ...liftStyleOf(lifted ?? null, task)]}
          onPointerDown={onPointerDown as never}
        >
          {children}
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={riseStyle}>
    <NativeDragHandle
      task={task}
      kind={kind}
      api={api}
      lift={lifted ?? null}
      style={style}
    >
      {children}
    </NativeDragHandle>
    </Animated.View>
  );
}

/* ------------------------------------------------------------- styles */

const styles = StyleSheet.create({
  // The pickup feedback: a quiet tint while the hold is running,
  // then a visible lift (scale and shadow) once the drag owns the
  // pointer. The ghost carries the motion after that.
  liftHold: {
    backgroundColor: colors.accentSoft,
  },
  liftPicked: {
    backgroundColor: colors.accentSoft,
    transform: [{ scale: 1.03 }],
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
});
