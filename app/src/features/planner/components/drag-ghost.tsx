import { Animated, StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { Overlay } from "@/components/ui/overlay-host";
import { colors, fonts, radiusFloating, spacing } from "@/theme/tokens";

/**
 * The drag ghost: one chip that rides the finger in every mode. It
 * draws through the overlay host at the drag layer, so it sits above
 * the screen and the bottom bar alike. The host fills the window, so
 * the ghost's coordinates are the pointer's page coordinates.
 */
export function DragGhost({
  task,
  x,
  y,
}: {
  /** The task in flight; null draws nothing. */
  task: TaskItem | null;
  x: Animated.Value;
  y: Animated.Value;
}) {
  if (task == null) {
    return null;
  }
  return (
    <Overlay layer="dragGhost">
      <Animated.View
        testID="drag-ghost"
        pointerEvents="none"
        style={[styles.ghost, { transform: [{ translateX: x }, { translateY: y }] }]}
      >
        <View style={styles.chip}>
          <View style={styles.bar} />
          <Text style={styles.text} numberOfLines={1}>
            {task.name}
          </Text>
        </View>
      </Animated.View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 200,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    backgroundColor: colors.accent,
    borderRadius: radiusFloating,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.onAccent,
    minHeight: 20,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.onAccent,
    fontWeight: "600",
  },
});
