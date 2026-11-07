import * as React from "react";
import { Animated, StyleSheet } from "react-native";
import { TaskRow } from "@/components/task-row";
import { Overlay } from "@/components/ui/overlay-host";
import { colors, pageGutter, radius, shadows } from "@/theme/tokens";
import type { Lifted } from "../hooks/use-row-reorder";

/**
 * The row that follows the pointer during a reorder, while the list
 * reflows under it. It draws through the `OverlayHost`, at the
 * drag-ghost layer, so no screen chrome covers it. Its slot in the
 * list stays empty, so the gap is the drop.
 */
export function ReorderGhost({
  lifted,
  y,
}: {
  lifted: Lifted | null;
  /** The ghost's top edge, in window coordinates. */
  y: Animated.Value;
}) {
  if (lifted == null) {
    return null;
  }
  return (
    <Overlay layer="dragGhost">
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ghost,
          lifted.width > 0
            ? { left: lifted.left, width: lifted.width }
            : { left: pageGutter, right: pageGutter },
          // A transform, not a layout prop: the ghost follows the
          // finger without a layout pass per frame.
          { top: 0, transform: [{ translateY: y }] },
        ]}
      >
        <TaskRow task={lifted.task} copy />
      </Animated.View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: "absolute",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius,
    ...shadows.lifted,
  },
});
