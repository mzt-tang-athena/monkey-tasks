import * as React from "react";
import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import {
  colors,
  fonts,
  spacing,
  radius,
  radii,
  touchTarget,
  type,
} from "@/theme/tokens";

/**
 * The app's button shapes, copied from their first homes: the capture
 * sheet's round send control, and the planner's retry control with its
 * wider padded pill. The `text` variant is a label with no fill, at
 * least 44pt high: Cancel, Dismiss, Retry, Open in day view. Its
 * `tone` sets the label color.
 *
 * The circle is icon-only, so its glyph is either the children or the
 * send arrow the sheet uses; the pill reads its label.
 */
export function Button({
  label,
  onPress,
  variant = "solid",
  tone = "accent",
  shape = "pill",
  disabled,
  busy,
  accessibilityLabel,
  hitSlop,
  children,
}: {
  label: string;
  onPress?: () => void;
  variant?: "solid" | "quiet" | "text";
  /** The label color of the `text` variant. */
  tone?: "accent" | "muted" | "danger";
  shape?: "pill" | "circle";
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  hitSlop?: PressableProps["hitSlop"];
  children?: React.ReactNode;
}) {
  const circle = shape === "circle";
  const quiet = variant === "quiet";
  if (variant === "text") {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.text,
          pressed && !disabled && styles.textPressed,
        ]}
        onPress={onPress}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        aria-disabled={disabled ?? false}
        aria-busy={busy ?? false}
      >
        {children ?? (
          <Text
            style={[
              styles.textLabel,
              textTone[tone],
              disabled && styles.disabledText,
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    );
  }
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

  // A label with no fill, on the touch target floor.
  text: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.s,
    borderRadius: radius,
  },
  textPressed: {
    backgroundColor: colors.pressed,
  },
  textLabel: {
    ...type.control,
    fontWeight: "600",
  },

  disabled: {
    backgroundColor: colors.pressed,
  },
  disabledText: {
    color: colors.inkFaint,
  },
});

const textTone = StyleSheet.create({
  accent: { color: colors.accent },
  muted: { color: colors.inkMuted, fontWeight: "400" },
  danger: { color: colors.danger },
});
