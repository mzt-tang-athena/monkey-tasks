import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "./pressable";
import { spacing, radius, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * Two quiet pill forms: the capture sheet's control chip, and the
 * parse chip that follows the input. Both are accentSoft with accent
 * text and square to the shared radius. The chip is tighter and
 * carries an optional glyph before its label.
 *
 * A pressable control keeps a 44 by 44 press target and draws a 32pt
 * chip inside it, so the spare height overlaps what sits above and
 * below, as the segmented control does. A control may hide its label
 * and draw only its glyph (the label still names it for assistive
 * tech), or end in a glyph of its own, such as the list switcher's
 * up-down caret.
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
  labelHidden,
  trailing,
  children,
}: {
  label: string;
  onPress?: () => void;
  tone?: "control" | "chip";
  accessibilityLabel?: string;
  selected?: boolean;
  /** Draw only the glyph. The label still names the control. */
  labelHidden?: boolean;
  /** A glyph after the label. */
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const chip = tone === "chip";
  // A fill only makes sense on a toggle, so a static pill ignores it.
  const on = selected === true && onPress != null;
  const body = (
    <>
      {children}
      {labelHidden === true ? null : (
        <Text
          numberOfLines={1}
          style={[
            chip ? styles.chipText : styles.controlText,
            on && styles.selectedText,
          ]}
        >
          {label}
        </Text>
      )}
      {trailing}
    </>
  );
  const shape = [
    chip ? styles.chip : styles.control,
    labelHidden === true && styles.glyphOnly,
  ];

  if (onPress == null) {
    return <View style={shape}>{body}</View>;
  }

  return (
    <Pressable
      style={styles.target}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-pressed={on}
    >
      {({ pressed }) => (
        <View
          style={[
            shape,
            on && styles.selected,
            pressed && (on ? styles.selectedPressed : styles.pressed),
          ]}
        >
          {body}
        </View>
      )}
    </Pressable>
  );
}

/** The chip's height. The press target keeps `touchTarget`. */
const controlHeight = 32;
const spare = (touchTarget - controlHeight) / 2;

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // The press target around a control chip.
    target: {
      minHeight: touchTarget,
      minWidth: touchTarget,
      paddingVertical: spare,
    },
    // A control chip: the sheet's list switcher, link and food controls.
    control: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      backgroundColor: colors.accentSoft,
      borderRadius: radius,
      paddingHorizontal: spacing.m,
      minWidth: touchTarget,
      height: controlHeight,
    },
    glyphOnly: {
      paddingHorizontal: 0,
    },
    controlText: {
      ...type.control,
      maxWidth: 200,
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
