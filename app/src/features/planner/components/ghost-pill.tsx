import { StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { colors, fonts, radiusFloating, spacing } from "@/theme/tokens";

/**
 * The chip the drag surface carries under the finger in every planner
 * mode. The surface owns where it sits and the lifted shadow; this is
 * the look, with no animation of its own.
 */
export function GhostPill({ task }: { task: TaskItem }) {
  return (
    <View pointerEvents="none" style={styles.chip}>
      <View style={styles.bar} />
      <Text style={styles.text} numberOfLines={1}>
        {task.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    backgroundColor: colors.accent,
    borderRadius: radiusFloating,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
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
