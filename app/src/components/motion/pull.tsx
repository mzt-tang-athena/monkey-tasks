import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { motion } from "@/lib/motion/tokens";
import { toJS } from "./internal/bridge";
import { withTouchAction } from "./internal/gesture";

/**
 * One pull up. The bottom bar's gap takes it and opens the command
 * pane, which rises the same way, so the pane meets the finger. The
 * gesture starts only inside the wrapped view, and a sideways travel
 * fails it, so a tab strip's scroll and the pager keep their swipes.
 *
 * `minPointers` stays at one, so a one-finger pull and a two-finger
 * pull up both travel the same path. The two-finger case is not proven
 * on the emulator.
 */
export function PullSurface({
  onPull,
  testID,
  style,
  children,
}: {
  onPull: () => void;
  testID?: string;
  /** The wrapped view's layout, for a pull target that holds a gap. */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const gesture = usePanGesture(
    withTouchAction("pan-x", {
      activeOffsetY: [-motion.pull.activate, motion.pull.activate] as [
        number,
        number,
      ],
      failOffsetX: [-motion.pull.failX, motion.pull.failX] as [number, number],
      onDeactivate: (event: { translationY: number; canceled: boolean }) => {
        "worklet";
        if (event.canceled) {
          return;
        }
        if (-event.translationY >= motion.pull.commit) {
          toJS(onPull);
        }
      },
    }),
  );

  return (
    <GestureDetector gesture={gesture}>
      <View testID={testID} style={style}>
        {children}
      </View>
    </GestureDetector>
  );
}
