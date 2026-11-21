import * as React from "react";
import { StyleSheet, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { spring, timing, type Progress } from "@/lib/motion/progress";
import { sheetFollow, sheetRelease } from "@/lib/motion/sheet-drag";
import { motion } from "@/lib/motion/tokens";
import { toJS } from "./internal/bridge";
import { withTouchAction } from "./internal/gesture";
import { usePressCancel } from "./internal/press-cancel";

type PaneRiseState = {
  open: boolean;
  onDismiss: () => void;
  /** How far the panel sits below its rest, from a finger. */
  offset: SharedValue<number>;
  /** The offset the current grab started from. */
  start: SharedValue<number>;
  dragging: SharedValue<boolean>;
};

const PaneRiseContext = React.createContext<PaneRiseState | null>(null);

/**
 * The rise of a pane that sits at the bottom edge, and the drag that
 * puts it back. The panel starts below its rest and rises on the
 * caller's clock. A downward drag on a `PaneGrab` follows the finger,
 * and a release past the threshold, or a downward flick, dismisses it
 * as a sheet does. The clock and the finger share one transform, so a
 * dismissed pane leaves once whatever the release.
 *
 * Only a `PaneGrab` inside it starts a drag, so a pane's scroller and
 * its search keep their own touches.
 */
export function PaneRise({
  open,
  progress,
  onDismiss,
  children,
}: {
  open: boolean;
  /** 0 closed to 1 open, from the caller's clock. */
  progress: Progress;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  const height = useSharedValue(0);
  const window = useWindowDimensions();

  // A pane that opens again brings a dismissed panel back to the clock,
  // from wherever the finger left it. While shut the panel is out of
  // the window, so the return shows only when it catches a reopen.
  React.useLayoutEffect(() => {
    if (!open) {
      return;
    }
    dragging.set(false);
    if (offset.get() !== 0) {
      offset.set(timing(0, motion.ms.sheet));
    }
  }, [open, dragging, offset]);

  // The clock lifts the panel from its rest. A drag carries it down
  // from there. The further of the two travels, so one dismiss never
  // adds the two. Before layout the panel's height is unknown, so the
  // window stands in and the first frame draws it out of sight.
  const rise = useAnimatedStyle(() => {
    const rest = height.value === 0 ? window.height : height.value;
    return {
      transform: [
        { translateY: Math.max(rest * (1 - progress.value), offset.value) },
      ],
    };
  }, [window.height]);

  const state = React.useMemo(
    () => ({ open, onDismiss, offset, start, dragging }),
    [open, onDismiss, offset, start, dragging],
  );

  return (
    <PaneRiseContext.Provider value={state}>
      <Animated.View
        testID="command-rise"
        pointerEvents="box-none"
        style={[styles.rise, rise]}
        onLayout={(event: LayoutChangeEvent) => {
          height.set(event.nativeEvent.layout.height);
        }}
      >
        {children}
      </Animated.View>
    </PaneRiseContext.Provider>
  );
}

/**
 * A place on the pane's panel where a downward drag sets it aside: the
 * row that carries its title. A tap on a control inside it still
 * presses. Outside a `PaneRise` it is a plain wrapper.
 */
export function PaneGrab({ children }: { children: React.ReactElement }) {
  const rise = React.useContext(PaneRiseContext);
  return rise == null ? children : <Grab rise={rise}>{children}</Grab>;
}

function Grab({
  rise,
  children,
}: {
  rise: PaneRiseState;
  children: React.ReactElement;
}) {
  const { open, onDismiss, offset, start, dragging } = rise;
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
        dragging.set(true);
        start.set(offset.value);
        toJS(pressCancel.arm);
      },
      onUpdate: (event: { translationY: number }) => {
        "worklet";
        if (dragging.value) {
          offset.set(sheetFollow(start.value + event.translationY));
        }
      },
      onDeactivate: (event: {
        translationY: number;
        velocityY: number;
        canceled: boolean;
      }) => {
        "worklet";
        if (!dragging.value) {
          return;
        }
        dragging.set(false);
        const travel = start.value + event.translationY;
        const verdict = event.canceled
          ? "return"
          : sheetRelease({ dy: travel, vy: event.velocityY });
        if (verdict === "dismiss") {
          // The clock carries the exit from where the finger let go.
          toJS(onDismiss);
          return;
        }
        offset.set(
          spring(0, {
            damping: motion.spring.pane.damping,
            stiffness: motion.spring.pane.stiffness,
            mass: motion.spring.pane.mass,
            velocity: event.velocityY,
          }),
        );
      },
    }),
  );

  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

const styles = StyleSheet.create({
  // The dock centers the panel. This view spans the dock, so the panel
  // keeps its own width and measure inside it.
  rise: {
    alignSelf: "stretch",
    alignItems: "center",
  },
});
