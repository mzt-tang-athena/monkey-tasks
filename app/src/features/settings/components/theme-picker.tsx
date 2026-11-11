import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import {
  THEMES,
  radius,
  spacing,
  touchTarget,
  type,
  type Palette,
  type ThemeName,
} from "@/theme/tokens";
import { useTheme, useThemedStyles } from "@/theme/theme-provider";

/** What each palette is called on screen. The record keys match the
    palette registry, so a new palette cannot ship without a name. */
const names: Record<ThemeName, string> = {
  budget: "Budget",
  todoist: "Todoist",
  clay: "Clay",
  midnight: "Midnight",
};

/**
 * The appearance picker: one radio per palette, each with a swatch of
 * that palette and its name. The group reads as a radio group to
 * assistive tech, and the active palette is the checked one. A press
 * switches the whole app in place.
 */
export function ThemePicker() {
  const { name: active, setTheme } = useTheme();
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View role="radiogroup" aria-label="Theme" style={styles.group}>
      {(Object.keys(THEMES) as ThemeName[]).map((name, index) => {
        const checked = name === active;
        return (
          <Pressable
            key={name}
            role="radio"
            aria-checked={checked}
            tabIndex={0}
            accessibilityLabel={names[name]}
            onPress={() => setTheme(name)}
            style={({ pressed }) => [
              styles.row,
              index === 0 ? styles.first : styles.divider,
              checked && styles.checked,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.swatch,
                {
                  backgroundColor: THEMES[name].paper,
                  borderColor: THEMES[name].hairline,
                },
              ]}
            >
              <View
                style={[styles.swatchDot, { backgroundColor: THEMES[name].accent }]}
              />
            </View>
            <Text style={[styles.label, checked && styles.labelChecked]}>
              {names[name]}
            </Text>
            {checked ? <Text style={styles.check}>{"✓"}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    group: {
      // The card's edge crops the selected row's fill.
      borderRadius: radius,
      overflow: "hidden",
    },
    row: {
      minHeight: touchTarget,
      minWidth: touchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.m,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
    },
    first: {},
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
    checked: {
      backgroundColor: colors.accentSoft,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: "center",
      justifyContent: "center",
    },
    swatchDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    label: {
      ...type.body,
      flex: 1,
      color: colors.ink,
    },
    labelChecked: {
      color: colors.accent,
      fontWeight: "600",
    },
    check: {
      ...type.meta,
      color: colors.accent,
    },
  }),
});
