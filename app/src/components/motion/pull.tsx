import * as React from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import { motion } from "@/lib/motion/tokens";
import { toJS } from "./internal/bridge";
import { withTouchAction } from "./internal/gesture";
import { usePressCancel } from "./internal/press-cancel";

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

/** An activation range's low end, far outside any screen's travel. */
const neverActive = -10_000;

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

/**
 * A downward pull on a page body. It acts only while the page's scroll
 * sits at the top, and only on a downward travel, so an upward drag
 * still scrolls the page and a sideways drag still turns the pager.
 * The scroll's own surface owns the offset; this surface takes the
 * answer as `enabled`.
 *
 * `startedAtTop` holds what the page read when the finger went down. A
 * drag that reaches the top partway through still only scrolls: the
 * commit reads that value, not the page's later state.
 *
 * The web takes the same pull through `MotionScrollView`, because the
 * browser owns a vertical drag there.
 */
export function PagePullSurface({
  enabled,
  startedAtTop,
  onPull,
  children,
}: {
  /** The page's scroll sits at the top, so a pull may open the pane. */
  enabled: boolean;
  /** The page's top state when the finger went down. */
  startedAtTop: SharedValue<boolean>;
  onPull: () => void;
  children: React.ReactNode;
}) {
  const pressCancel = usePressCancel();
  const gesture = usePanGesture(
    withTouchAction("pan-y", {
      // A downward travel alone activates it. The low start is never
      // reached, so an upward drag only ever fails the range and the
      // page keeps its scroll.
      activeOffsetY: [neverActive, motion.pull.activate] as [number, number],
      failOffsetX: [-motion.pull.failX, motion.pull.failX] as [number, number],
      enabled,
      onActivate: () => {
        "worklet";
        // A pull that starts on a row must not also press it.
        if (startedAtTop.value) {
          toJS(pressCancel.arm);
        }
      },
      onDeactivate: (event: { translationY: number; canceled: boolean }) => {
        "worklet";
        if (event.canceled || !startedAtTop.value) {
          return;
        }
        if (event.translationY >= motion.pull.commit) {
          toJS(onPull);
        }
      },
    }),
  );

  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}
