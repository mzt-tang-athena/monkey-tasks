import * as React from "react";
import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import {
  colors,
  fonts,
  spacing,
  radius,
  radii,
  touchTarget,
} from "../../theme/tokens";

/**
 * The app's two button shapes, copied from their first homes: the
 * capture sheet's 32pt round send control, and the planner's retry
 * control with its wider padded pill.
 *
 * The circle is icon-only, so its glyph is either the children or the
 * send arrow the sheet uses; the pill reads its label.
 */
export function Button({
  label,
  onPress,
  variant = "solid",
  shape = "pill",
  disabled,
  busy,
  accessibilityLabel,
  hitSlop,
  children,
}: {
  label: string;
  onPress?: () => void;
  variant?: "solid" | "quiet";
  shape?: "pill" | "circle";
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  hitSlop?: PressableProps["hitSlop"];
  children?: React.ReactNode;
}) {
  const circle = shape === "circle";
  const quiet = variant === "quiet";
  return (
    <Pressable
      style={({ pressed }) => [
        circle ? styles.circle : styles.pill,
        quiet ? styles.quiet : styles.solid,
        pressed && !disabled && (quiet ? styles.quietPressed : styles.pressed),
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-disabled={disabled ?? false}
      aria-busy={busy ?? false}
    >
      {circle && children == null ? (
        <Text
          style={[
            styles.circleText,
            quiet && styles.quietText,
            disabled && styles.disabledText,
          ]}
        >
          {"↑"}
        </Text>
      ) : children != null ? (
        children
      ) : (
        <Text
          style={[
            styles.pillText,
            quiet && styles.quietText,
            disabled && styles.disabledText,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The save control: an icon-only circle at the touch target floor,
  // so the action row reads as two matching rounded forms.
  circle: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  circleText: {
    color: colors.onAccent,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.body,
    fontWeight: "700",
  },

  // The planner's retry control: a padded label pill.
  pill: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.l,
    borderRadius: radius,
  },
  pillText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    fontWeight: "600",
    color: colors.onAccent,
  },

  solid: {
    backgroundColor: colors.accent,
  },
  pressed: {
    backgroundColor: colors.accentDeep,
  },

  // The quieter fill the sheet's chips and target pill share.
  quiet: {
    backgroundColor: colors.accentSoft,
  },
  quietPressed: {
    backgroundColor: colors.pressed,
  },
  quietText: {
    color: colors.accent,
  },

  disabled: {
    backgroundColor: colors.pressed,
  },
  disabledText: {
    color: colors.inkFaint,
  },
});
