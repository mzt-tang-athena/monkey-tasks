import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  colors,
  fonts,
  spacing,
  radius,
  radii,
  touchTarget,
} from "../../theme/tokens";

/**
 * Two quiet pill forms: the capture sheet's target list control, and
 * the parse chip that follows the input. Both are accentSoft with
 * accent text; the chip is tighter, squared to the shared radius, and
 * carries an optional glyph before its label.
 */
export function Pill({
  label,
  onPress,
  tone = "control",
  accessibilityLabel,
  children,
}: {
  label: string;
  onPress?: () => void;
  tone?: "control" | "chip";
  accessibilityLabel?: string;
  children?: React.ReactNode;
}) {
  const chip = tone === "chip";
  const body = (
    <>
      {children}
      <Text style={chip ? styles.chipText : styles.controlText}>{label}</Text>
    </>
  );

  if (onPress == null) {
    return <View style={chip ? styles.chip : styles.control}>{body}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        chip ? styles.chip : styles.control,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Target list pill, inside the sheet's action row.
  control: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    minHeight: touchTarget,
    justifyContent: "center",
  },
  controlText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
  pressed: {
    backgroundColor: colors.pressed,
  },

  // Parse feedback chip, one per parsed field.
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius,
    paddingHorizontal: spacing.s,
    height: 24,
  },
  chipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
});
