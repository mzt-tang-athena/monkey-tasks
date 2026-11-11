import * as React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { taskRowFace } from "@/components/task-row-face";
import type { CardPosition } from "@/lib/motion/drag-math";
import { colors, radius } from "@/theme/tokens";

export { cardPosition, type CardPosition } from "@/lib/motion/drag-math";

/**
 * One row of a group card (ADR 0030). A card is built from its rows:
 * every row draws the sides, the first adds the top and its corners,
 * and the last adds the bottom. A row below another draws the divider
 * at its own top, inset to the task text, so a dragged row carries its
 * divider with it. The live list draws its cards through
 * `ListReorder.Item`; this still card shapes the page preview.
 */
export function CardGroupRow({
  position,
  style,
  children,
}: {
  position: CardPosition;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const top = position === "first" || position === "only";
  const bottom = position === "last" || position === "only";
  return (
    <View style={[styles.row, top && styles.top, bottom && styles.bottom, style]}>
      {top ? null : <View testID="card-divider" style={styles.divider} />}
      {children}
    </View>
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
