import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "./pressable";
import { spacing, radius, radii, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * Two quiet pill forms: the capture sheet's target list control, and
 * the parse chip that follows the input. Both are accentSoft with
 * accent text; the chip is tighter, squared to the shared radius, and
 * carries an optional glyph before its label.
 *
 * A pressable pill with `selected` is a toggle, like the journal's Food
 * chip: it reads as pressed and fills with the accent while on.
 */
export function Pill({
  label,
  onPress,
  tone = "control",
  accessibilityLabel,
  selected,
  children,
}: {
  label: string;
  onPress?: () => void;
  tone?: "control" | "chip";
  accessibilityLabel?: string;
  selected?: boolean;
  children?: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const chip = tone === "chip";
  // A fill only makes sense on a toggle, so a static pill ignores it.
  const on = selected === true && onPress != null;
  const body = (
    <>
      {children}
      <Text
        style={[
          chip ? styles.chipText : styles.controlText,
          on && styles.selectedText,
        ]}
      >
        {label}
      </Text>
    </>
  );

  if (onPress == null) {
    return <View style={chip ? styles.chip : styles.control}>{body}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        chip ? styles.chip : styles.control,
        on && styles.selected,
        pressed && (on ? styles.selectedPressed : styles.pressed),
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-pressed={on}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // Target list pill, inside the sheet's action row.
    control: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      backgroundColor: colors.accentSoft,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.m,
      minHeight: touchTarget,
      justifyContent: "center",
    },
    controlText: {
      ...type.control,
      color: colors.accent,
      fontWeight: "600",
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    selected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    selectedPressed: {
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentDeep,
    },
    selectedText: {
      color: colors.onAccent,
    },

    // Parse feedback chip, one per parsed field.
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      backgroundColor: colors.accentSoft,
      borderRadius: radius,
      paddingHorizontal: spacing.s,
      height: 24,
    },
    chipText: {
      ...type.caption,
      color: colors.accent,
      fontWeight: "600",
    },
  }),
});
