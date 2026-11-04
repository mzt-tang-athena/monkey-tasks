import { StyleSheet, View, type PointerEvent as RNPointerEvent } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import type { SplitPane } from "@/features/planner/hooks/use-split-pane";
import { colors, radius } from "@/theme/tokens";
import { pointerPickup } from "../drag";
import { usePlannerList } from "../planner-list-context";

/**
 * The dashed drop line between the timeline and the list, with the
 * grabber on it. The line is quiet until a drag starts. The grabber
 * resizes the split: by pointer on web, by a pan on native. The swipe
 * preview draws it at rest, with no `split`.
 */
export function SplitHandle({ split }: { split: SplitPane | null }) {
  const { lifted } = usePlannerList();
  const dragging = lifted?.phase === "picked";
  const hot = split?.hot ?? false;

  // A plain View: a Pressable takes the responder and the native pan
  // then never sees the drag.
  const grabber = (
    <View
      style={[styles.hit, hot && styles.hitHot]}
      accessibilityRole="button"
      accessibilityLabel="resize timeline"
      {...(split != null && pointerPickup
        ? {
            onHoverIn: () => split.setHot(true),
            onHoverOut: () => split.setHot(false),
            // The grabber claims the gesture: resizing must never fire
            // a day swipe.
            onPointerDown: (e: RNPointerEvent) => split.begin(e.nativeEvent.pageY),
          }
        : {})}
    >
      <View style={[styles.bar, (hot || dragging) && styles.barActive]} />
    </View>
  );

  return (
    <View style={styles.divider}>
      <View
        style={[styles.line, (dragging || split?.active) && styles.lineActive]}
      />
      {split != null && !pointerPickup ? (
        <GestureDetector gesture={split.pan}>{grabber}</GestureDetector>
      ) : (
        grabber
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 28,
    justifyContent: "center",
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 13,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.hairline,
  },
  lineActive: {
    borderTopColor: colors.accent,
  },
  hit: {
    alignSelf: "center",
    width: 72,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
  },
  hitHot: {
    backgroundColor: colors.pressed,
  },
  bar: {
    width: 44,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.inkFaint,
  },
  barActive: {
    backgroundColor: colors.accent,
  },
});
