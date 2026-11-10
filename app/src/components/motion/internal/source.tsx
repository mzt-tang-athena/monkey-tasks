import * as React from "react";
import { StyleSheet, type StyleProp, type View, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { hitZone, type Hit } from "@/lib/motion/drag-math";
import { holds, motion, type HoldKind } from "@/lib/motion/tokens";
import { colors } from "@/theme/tokens";
import { toJS } from "./bridge";
import { useSessionContext } from "./contexts";
import { measureZones, send, type SessionUI } from "./session";
import { withTouchAction } from "./gesture";

const reduce = ReduceMotion.System;

function sameHit(a: Hit | null, b: Hit | null): boolean {
  "worklet";
  return a === b || (a !== null && b !== null && a.id === b.id && a.cell === b.cell);
}

/** Moves the finger and the hover. Only the owner calls it. */
function track(ui: SessionUI, x: number, y: number): void {
  "worklet";
  ui.x.set(x);
  ui.y.set(y);
  const rects = ui.rects.value;
  const hit = hitZone(x, y, rects.zones, rects.grids, rects.clips);
  if (!sameHit(hit, ui.hover.value)) {
    ui.hover.set(hit);
  }
}

/** The lift falls back to rest, and the session settles when it lands.
    A flush cuts it short. */
function settle(ui: SessionUI): void {
  "worklet";
  ui.hover.set(null);
  const back = { duration: motion.ms.return, easing: motion.easeOut, reduceMotion: reduce };
  ui.lift.set(
    withTiming(0, back, (finished) => {
      "worklet";
      if (finished === true) {
        send(ui, { type: "settled" });
      }
    }),
  );
}

/** A source that unmounts mid drag cancels it: its gesture may never
    finalize, and the session would wait on it. */
function abandon(ui: SessionUI, source: number, cancel: (generation: number) => void): void {
  "worklet";
  if (send(ui, { type: "finalize", source }) === "cancel") {
    toJS(cancel, ui.generation.value);
    settle(ui);
  }
}

/**
 * A drag source. A row or a pill lifts after its hold, and a grip
 * lifts on the first move. The surface owns the look: the hold tint,
 * the shake at pickup and the dimmed source while its ghost moves.
 */
export function Source({
  payload,
  hold,
  disabled = false,
  style,
  testID,
  children,
}: {
  payload: unknown;
  hold: HoldKind;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}) {
  const session = useSessionContext("Source");
  const { ui, handlers } = session;
  const [id] = React.useState(session.nextId);
  React.useLayoutEffect(() => {
    session.payloads.set(id, payload);
  });
  React.useEffect(
    () => () => {
      session.payloads.delete(id);
      scheduleOnUI(abandon, ui, id, handlers.cancel);
    },
    [session, ui, handlers, id],
  );

  const self = useAnimatedRef<View>();
  const cue = useSharedValue(0);
  const shake = useSharedValue(0);
  const { ms, touchAction } = holds[hold];
  const grip = hold === "grip";

  const gesture = usePanGesture(
    // The worklets read the animated ref on the UI thread, never in render.
    // eslint-disable-next-line react-hooks/refs
    withTouchAction(touchAction, {
      enabled: !disabled,
      minDistance: grip ? 0 : undefined,
      activateAfterLongPress: grip ? undefined : ms,
      onBegin: () => {
        "worklet";
        if (send(ui, { type: "begin", source: id }) === "flush") {
          ui.lift.set(0);
          ui.hover.set(null);
        }
        if (!grip) {
          cue.set(withDelay(
            motion.hold.cue,
            withTiming(1, { duration: ms - motion.hold.cue, reduceMotion: reduce }),
          ));
        }
      },
      onActivate: (e) => {
        "worklet";
        if (send(ui, { type: "activate", source: id }) !== "pickup") {
          return;
        }
        const generation = ui.generation.value + 1;
        ui.generation.set(generation);
        const box = measure(self);
        if (box !== null) {
          ui.grab.set({
            dx: e.absoluteX - box.pageX,
            dy: e.absoluteY - box.pageY,
            width: box.width,
          });
        }
        measureZones(ui, generation);
        cue.set(1);
        ui.lift.set(withTiming(1, { duration: motion.ms.tap, reduceMotion: reduce }));
        shake.set(withSequence(
          withTiming(-2.5, { duration: 40, reduceMotion: reduce }),
          withTiming(2.5, { duration: 50, reduceMotion: reduce }),
          withTiming(-1.5, { duration: 50, reduceMotion: reduce }),
          withTiming(0, { duration: 40, reduceMotion: reduce }),
        ));
        track(ui, e.absoluteX, e.absoluteY);
        toJS(handlers.pickup, id, generation);
      },
      onUpdate: (e) => {
        "worklet";
        const state = ui.machine.value;
        if (state.phase === "dragging" && state.owner === id) {
          track(ui, e.absoluteX, e.absoluteY);
        }
      },
      onDeactivate: (e) => {
        "worklet";
        const hit = ui.hover.value;
        const effect = send(ui, { type: "release", source: id, canceled: e.canceled });
        if (effect === "drop") {
          toJS(handlers.drop, ui.generation.value, hit);
          settle(ui);
        } else if (effect === "cancel") {
          toJS(handlers.cancel, ui.generation.value);
          settle(ui);
        }
      },
      onFinalize: () => {
        "worklet";
        if (send(ui, { type: "finalize", source: id }) === "cancel") {
          toJS(handlers.cancel, ui.generation.value);
          settle(ui);
        }
        cue.set(withTiming(0, { duration: motion.ms.tap, reduceMotion: reduce }));
      },
    }),
  );

  const look = useAnimatedStyle(() => {
    const state = ui.machine.value;
    const mine = state.owner === id && state.phase !== "idle" && state.phase !== "pending";
    return {
      opacity: mine ? 1 - 0.5 * ui.lift.value : 1,
      transform: [{ translateX: shake.value }],
    };
  });
  const tint = useAnimatedStyle(() => ({ opacity: cue.value }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={self} collapsable={false} testID={testID} style={[style, look]}>
        <Animated.View pointerEvents="none" style={[styles.tint, tint]} />
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  tint: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.accentSoft,
  },
});
