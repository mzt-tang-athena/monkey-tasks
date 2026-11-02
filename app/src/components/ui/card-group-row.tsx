import * as React from "react";
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { taskRowFace } from "@/components/task-row-face";
import { colors, radius } from "@/theme/tokens";

export type CardPosition = "first" | "middle" | "last" | "only";

/** Where row `index` of `count` sits in its card. */
export function cardPosition(index: number, count: number): CardPosition {
  if (count <= 1) {
    return "only";
  }
  if (index === 0) {
    return "first";
  }
  return index === count - 1 ? "last" : "middle";
}

/**
 * One row of a group card (ADR 0030). A card is built from its rows:
 * every row draws the sides, the first adds the top and its corners,
 * and the last adds the bottom. A row below another draws the divider
 * at its own top, inset to the task text, so a dragged row carries its
 * divider with it.
 *
 * It renders an animated view, so a caller can pass a drag transform
 * in `style`.
 */
export function CardGroupRow({
  position,
  style,
  ref,
  children,
}: {
  position: CardPosition;
  style?: StyleProp<Animated.WithAnimatedValue<ViewStyle>>;
  ref?: React.Ref<React.ComponentRef<typeof Animated.View>>;
  children: React.ReactNode;
}) {
  const top = position === "first" || position === "only";
  const bottom = position === "last" || position === "only";
  return (
    <Animated.View
      ref={ref}
      style={[styles.row, top && styles.top, bottom && styles.bottom, style]}
    >
      {top ? null : <View testID="card-divider" style={styles.divider} />}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  top: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
  },
  bottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius,
    borderBottomRightRadius: radius,
  },
  divider: {
    position: "absolute",
    left: taskRowFace.textInset,
    right: 0,
    top: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
});
