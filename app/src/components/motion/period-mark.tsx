import * as React from "react";
import { StyleSheet } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { markBetween, type MarkPlace } from "@/lib/motion/mark-math";
import { motion } from "@/lib/motion/tokens";
import { radius, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import type { PageFollow } from "./page-follow";

/** A cell's place in its row. A strip measures its cells into these. */
export type { MarkPlace };

/** A page cut crosses on its own clock. Reduced motion lands it at once. */
function over(ms: number) {
  "worklet";
  return { duration: ms, easing: motion.easeOut, reduceMotion: ReduceMotion.System };
}

/**
 * The filled mark of a period strip, which rides a pager from cell to
 * cell. With a page follow it reads the pager's live position on the UI
 * thread, so it tracks the finger and sits halfway between two cells at
 * half a page. A tap one cell away rides the pager's own slide, and a
 * longer jump cuts the page, so the mark crosses on its own clock
 * (ADR 0046).
 *
 * `children` is a copy of the row's labels in the lit colours. The mark
 * clips it to itself, so the label over the mark reads lit wherever the
 * mark lands, and the label beneath stays for the cells it has left.
 */
export function PeriodMark({
  follow,
  at,
  places,
  rides = true,
  children,
  testID,
}: {
  follow?: PageFollow;
  /** The cell that holds the page the strip last rendered on. */
  at: number;
  /** Each cell's place in the row, or null before layout. */
  places: readonly (MarkPlace | null)[];
  /** False where the row's window follows the page, so the mark holds
      its cell and the labels slide under it. */
  rides?: boolean;
  /** The row's labels in the lit colours, laid out as the row is. */
  children: React.ReactNode;
  testID?: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const shown = useSharedValue(at);
  // The cell the strip was rendered on, as a shared value: it then
  // reaches the UI thread in the same batch as the pager's page, so a
  // landing never draws one frame from the old cell and the new page.
  const cell = useSharedValue(at);
  React.useLayoutEffect(() => {
    cell.set(at);
  }, [at, cell]);

  useAnimatedReaction(
    () =>
      follow == null || !rides
        ? cell.value
        : cell.value + follow.progress.value - follow.page.value,
    (place) => {
      if (follow == null || follow.touching.value === 1) {
        shown.set(place);
        return;
      }
      if (Math.abs(place - shown.value) <= 1) {
        shown.set(place);
        return;
      }
      // The page cut, so the mark crosses on its own clock.
      shown.set(withTiming(place, over(motion.ms.settle)));
    },
  );

  const box = useAnimatedStyle(() => {
    const mark = markBetween(places, shown.value, 0);
    return { left: mark.left, width: mark.width, opacity: mark.width > 0 ? 1 : 0 };
  });

  const copy = useAnimatedStyle(() => ({
    transform: [{ translateX: -markBetween(places, shown.value, 0).left }],
  }));

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      aria-hidden
      style={[styles.mark, box]}
    >
      <Animated.View
        testID={testID == null ? undefined : `${testID}:copy`}
        style={[styles.copy, copy]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // The selected cell hangs from the strip's top edge: square top,
    // rounded bottom, standing taller than its resting neighbours.
    mark: {
      position: "absolute",
      top: 0,
      height: 52,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: radius,
      borderBottomRightRadius: radius,
      backgroundColor: colors.accent,
      overflow: "hidden",
    },
    copy: {
      position: "absolute",
      top: 0,
      left: 0,
    },
  }),
});
