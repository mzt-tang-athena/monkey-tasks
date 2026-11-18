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

/** The page's opener, read by its scrollers. */
const PagePullContext = React.createContext<(() => void) | null>(null);

/**
 * Makes a page's scrollers pull its command pane open. Every
 * `MotionScrollView` under this provider opens the pane on a downward
 * pull that starts while its own scroll sits at the top.
 *
 * A sheet that draws over a page stays out of the provider, so its own
 * scroller never opens the pane behind it.
 */
export function PagePull({
  onPull,
  children,
}: {
  onPull: () => void;
  children: React.ReactNode;
}) {
  return (
    <PagePullContext.Provider value={onPull}>
      {children}
    </PagePullContext.Provider>
  );
}

/** The page's pull, or null when the screen has none. */
export function usePagePull(): (() => void) | null {
  return React.useContext(PagePullContext);
}
