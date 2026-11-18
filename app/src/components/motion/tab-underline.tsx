import * as React from "react";
import { StyleSheet } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { tabUnderline, type TabBox } from "@/lib/motion/tab-math";
import { motion } from "@/lib/motion/tokens";
import type { Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import type { PageFollow } from "./page-follow";

/** A settle, or a tap's cross. Reduced motion lands it at once. */
function over(ms: number) {
  "worklet";
  return { duration: ms, easing: motion.easeOut, reduceMotion: ReduceMotion.System };
}

/**
 * The rule under the selected tab. With a page follow it reads the
 * pager's live position on the UI thread, so it tracks the finger
 * across a swipe, halfway between two tabs at half a page. A tap moves
 * it to the tapped tab: a one-page move rides the pager's own slide,
 * and a longer jump crosses on its own clock because the page cuts.
 * Without a follow a tap slides it. The strip places it in its content
 * below the tabs. Reduced motion jumps it (ADR 0046).
 */
export function TabUnderline({
  follow,
  selected,
  boxes,
  inset,
  testID,
}: {
  follow?: PageFollow;
  /** The selected tab's index. Where the bar stands at mount. */
  selected: number;
  /** Each tab's place in the strip's content, or null before layout. */
  boxes: readonly (TabBox | null)[];
  /** The bar's gap from each tab's edge, in px. */
  inset: number;
  testID?: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const shown = useSharedValue(selected);

  useAnimatedReaction(
    () => (follow == null ? 0 : follow.origin.value + follow.progress.value),
    (page) => {
      if (follow == null) {
        return;
      }
      if (follow.touching.value === 1 || Math.abs(page - shown.value) <= 1) {
        shown.set(page);
        return;
      }
      // The page cut, so the bar crosses on its own clock.
      shown.set(withTiming(page, over(motion.ms.settle)));
    },
  );

  // No pager: a tap slides the bar to the tapped tab.
  React.useEffect(() => {
    if (follow != null) {
      return;
    }
    shown.set(withTiming(selected, over(motion.ms.settle)));
  }, [follow, selected, shown]);

  const bar = useAnimatedStyle(() => {
    const box = tabUnderline(boxes, shown.value, inset);
    return {
      left: box.left,
      width: box.width,
      opacity: box.width > 0 ? 1 : 0,
    };
  });

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[styles.bar, bar]}
    />
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    bar: {
      position: "absolute",
      bottom: 0,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.accent,
    },
  }),
});
