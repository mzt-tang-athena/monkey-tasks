import * as React from "react";
import { StyleSheet } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { motion } from "@/lib/motion/tokens";
import type { Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * A scroller's offset, in px from its top. `MotionScrollView` writes it
 * on the UI thread. A feature holds it and writes nothing.
 */
export type ScrollOffset = SharedValue<number>;

/** The offset a `MotionScrollView` writes when it is given one. */
export function useScrollEdgeOffset(): ScrollOffset {
  return useSharedValue(0);
}

/** How far a scroller leaves its top before its edge shows, in px. */
export const edgeScroll = 1;

/** The line's own clock. Reduced motion lands it at once. */
function fade(to: number) {
  "worklet";
  return withTiming(to, {
    duration: motion.ms.menu,
    easing: motion.easeOut,
    reduceMotion: ReduceMotion.System,
  });
}

/**
 * The hairline at the top of a scroller's box: the line where content
 * cuts off as it slides under a header. The parent places it over the
 * scroller's first row, and it takes no press. With `offset` it follows
 * the scroller on the UI thread and shows once content passes under it,
 * so a page at its top carries no line. Without `offset` it always
 * shows, and `shown` makes a still copy match the page it previews.
 * Reduced motion shows the rule at once, with no fade (ADR 0046).
 */
export function ScrollEdge({
  offset,
  shown = true,
  testID,
}: {
  /** The live offset of the scroller under the line. */
  offset?: ScrollOffset;
  /** Whether a still line shows. It is ignored beside `offset`. */
  shown?: boolean;
  testID?: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const level = useSharedValue(offset == null && shown ? 1 : 0);

  useAnimatedReaction(
    () => (offset == null ? null : offset.value > edgeScroll ? 1 : 0),
    (next) => {
      if (next == null) {
        return;
      }
      level.value = fade(next);
    },
  );

  const style = useAnimatedStyle(() => ({
    opacity: offset == null ? (shown ? 1 : 0) : level.value,
  }));

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[styles.edge, style]}
    />
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    edge: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.hairline,
    },
  }),
});
