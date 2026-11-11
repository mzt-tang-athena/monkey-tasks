import * as React from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { motion } from "@/lib/motion/tokens";
import { toJS } from "./internal/bridge";
import { withTouchAction } from "./internal/gesture";

/**
 * One pull, in one direction. A downward pull on a header band opens
 * the command pane; an upward pull on the pane's own top closes it. The
 * gesture starts only inside the wrapped view, and a sideways travel
 * fails it, so a tab strip's scroll and the pager keep their swipes.
 *
 * `minPointers` stays at one, so a one-finger pull and a two-finger
 * swipe down both travel the same path. The two-finger case is not
 * proven on the emulator.
 */
export function PullSurface({
  direction,
  onPull,
  testID,
  children,
}: {
  direction: "down" | "up";
  onPull: () => void;
  testID?: string;
  children: React.ReactNode;
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
        const travel =
          direction === "down" ? event.translationY : -event.translationY;
        const commit =
          direction === "up" ? motion.pull.close : motion.pull.commit;
        if (travel >= commit) {
          toJS(onPull);
        }
      },
    }),
  );

  return (
    <GestureDetector gesture={gesture}>
      <View testID={testID}>{children}</View>
    </GestureDetector>
  );
}
