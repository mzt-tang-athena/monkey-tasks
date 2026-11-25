import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "./pressable";
import { radii, touchTarget, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * A switch in the active palette. React Native's own `Switch` ignores
 * the palette on both platforms, so this draws the track and the knob
 * from theme tokens. The 44pt press target holds a 44 by 26 track,
 * which is the smallest shape that still reads as a switch at a thumb's
 * distance.
 */
export function Switch({
  checked,
  label,
  onCheckedChange,
  testID,
  trackTestID,
}: {
  checked: boolean;
  /** The control's name. The row's text sits outside it. */
  label: string;
  onCheckedChange: (next: boolean) => void;
  testID?: string;
  /** Names the track, so a paint check can read its fill. */
  trackTestID?: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable
      testID={testID}
      role="switch"
      aria-checked={checked}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onCheckedChange(!checked)}
      style={({ pressed }) => [styles.target, pressed && styles.pressed]}
    >
      <View
        testID={trackTestID}
        style={[styles.track, checked ? styles.trackOn : styles.trackOff]}
      >
        <View style={[styles.knob, checked ? styles.knobOn : styles.knobOff]} />
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    target: {
      width: touchTarget,
      height: touchTarget,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.7,
    },
    track: {
      width: 44,
      height: 26,
      borderRadius: radii.pill,
      borderWidth: 1,
      padding: 2,
      justifyContent: "center",
    },
    trackOn: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
      alignItems: "flex-end",
    },
    trackOff: {
      backgroundColor: colors.pressed,
      borderColor: colors.inkMuted,
      alignItems: "flex-start",
    },
    knob: {
      width: 20,
      height: 20,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
    },
    knobOn: {
      borderWidth: 1,
      borderColor: colors.accent,
    },
    knobOff: {
      borderWidth: 1,
      borderColor: colors.inkMuted,
    },
  }),
});
