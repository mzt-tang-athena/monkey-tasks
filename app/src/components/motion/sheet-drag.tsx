import * as React from "react";
import { StyleSheet, type LayoutChangeEvent } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { timing } from "@/lib/motion/progress";
import {
  sheetFollow,
  sheetRelease,
  sheetStep,
  type SheetDragPhase,
} from "@/lib/motion/sheet-drag";
import { motion } from "@/lib/motion/tokens";
import { toJS } from "./internal/bridge";
import { withTouchAction } from "./internal/gesture";
import { usePressCancel } from "./internal/press-cancel";

type SheetDragState = {
  open: boolean;
  onDismiss: () => void;
  offset: SharedValue<number>;
  /** The offset the current grab started from. */
  start: SharedValue<number>;
  phase: SharedValue<SheetDragPhase>;
  /** The panel's height, so a dismissed panel slides out of sight. */
  height: SharedValue<number>;
};

const SheetDragContext = React.createContext<SheetDragState | null>(null);

/**
 * Drag to dismiss for a sheet's panel. The panel moves inside this
 * view, so the drag never meets the keyboard lift or the open clock in
 * one style. Only a `SheetGrab` inside it starts a drag, so a scroller,
 * a strip or a text field in the panel keeps its own touches.
 *
 * A release past the threshold, or a downward flick, calls `onDismiss`
 * and slides the panel out while the caller's clock fades it. Any other
 * release springs back. An upward drag stretches a little and returns.
 */
export function SheetDrag({
  open,
  onDismiss,
  children,
}: {
  open: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  const phase = useSharedValue<SheetDragPhase>("idle");
  const height = useSharedValue(0);

  // A sheet that opens again brings a dismissed panel back with the
  // open clock.
  React.useLayoutEffect(() => {
    if (!open) {
      return;
    }
    phase.set(sheetStep(phase.get(), "reopen") ?? "idle");
    if (offset.get() !== 0) {
      offset.set(timing(0, motion.ms.sheet));
    }
  }, [open, offset, phase]);

  const follow = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  const state = React.useMemo(
    () => ({ open, onDismiss, offset, start, phase, height }),
    [open, onDismiss, offset, start, phase, height],
  );

  return (
    <SheetDragContext.Provider value={state}>
      <Animated.View
        pointerEvents="box-none"
        style={[styles.follow, follow]}
        onLayout={(event: LayoutChangeEvent) => {
          height.set(event.nativeEvent.layout.height);
        }}
      >
        {children}
      </Animated.View>
    </SheetDragContext.Provider>
  );
}

/**
 * A place on the panel where a downward drag dismisses the sheet: the
 * handle, and a header row with nothing in it that scrolls. A tap on a
 * control inside it still presses. Outside a `SheetDrag` it is a plain
 * wrapper.
 */
export function SheetGrab({ children }: { children: React.ReactElement }) {
  const drag = React.useContext(SheetDragContext);
  return drag == null ? children : <Grab drag={drag}>{children}</Grab>;
}

function Grab({
  drag,
  children,
}: {
  drag: SheetDragState;
  children: React.ReactElement;
}) {
  const { open, onDismiss, offset, start, phase, height } = drag;
  const pressCancel = usePressCancel();

  const gesture = usePanGesture(
    withTouchAction("none", {
      enabled: open,
      activeOffsetY: [-motion.pull.activate, motion.pull.activate] as [
        number,
        number,
      ],
      failOffsetX: [-motion.pull.failX, motion.pull.failX] as [number, number],
      onActivate: () => {
        "worklet";
        const next = sheetStep(phase.value, "grab");
        if (next === null) {
          return;
        }
        phase.set(next);
        start.set(offset.value);
        toJS(pressCancel.arm);
      },
      onUpdate: (event: { translationY: number }) => {
        "worklet";
        if (phase.value === "dragging") {
          offset.set(sheetFollow(start.value + event.translationY));
        }
      },
      onDeactivate: (event: {
        translationY: number;
        velocityY: number;
        canceled: boolean;
      }) => {
        "worklet";
        if (phase.value !== "dragging") {
          return;
        }
        const verdict = event.canceled
          ? "return"
          : sheetRelease({
              dy: start.value + event.translationY,
              vy: event.velocityY,
            });
        phase.set(sheetStep(phase.value, verdict) ?? "idle");
        if (verdict === "dismiss") {
          offset.set(timing(offset.value + height.value, motion.ms.sheet));
          toJS(onDismiss);
          return;
        }
        offset.set(
          withSpring(
            0,
            {
              damping: motion.spring.pane.damping,
              stiffness: motion.spring.pane.stiffness,
              mass: motion.spring.pane.mass,
              velocity: event.velocityY,
              reduceMotion: ReduceMotion.System,
            },
            (finished) => {
              "worklet";
              const settled = sheetStep(phase.value, "settled");
              if (finished === true && settled !== null) {
                phase.set(settled);
              }
            },
          ),
        );
      },
    }),
  );

  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

const styles = StyleSheet.create({
  // The dock centers the panel. This view spans the dock, so the panel
  // keeps its own width and measure inside it.
  follow: {
    alignSelf: "stretch",
    alignItems: "center",
  },
});
