import * as React from "react";
import { StyleSheet, Text } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { radius, spacing, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * A bare Pressable in the app's press look, so the primitive's rest and
 * pressed states have something to show. The pressed cell keeps the
 * pressed ground on screen; the rest cell gives it up when the pointer
 * lifts, which is the same render-prop press every caller gets.
 */
export function PressTarget({
  paint,
  testID,
}: {
  paint: "rest" | "pressed";
  testID: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.target,
        (pressed || paint === "pressed") && styles.pressed,
      ]}
      onPress={() => undefined}
      accessibilityRole="button"
    >
      <Text style={styles.label}>press me</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    target: {
      minHeight: touchTarget,
      minWidth: 120,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.l,
      borderRadius: radius,
      backgroundColor: colors.accentSoft,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    label: {
      ...type.control,
      fontWeight: "600",
      color: colors.accent,
    },
  }),
});
