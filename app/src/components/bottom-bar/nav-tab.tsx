import * as React from "react";
import { StyleSheet } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { bottomBar, radius, spacing, touchTarget, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * One nav item of the bottom bar: the glyph alone. The fill weight and
 * the accent color carry the selection, with no dot and no label. The
 * label stays as the name assistive tech reads.
 */
export function NavTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      aria-selected={active}
    >
      <Icon
        name={icon}
        weight={active ? "fill" : "outline"}
        color={active ? "accent" : "inkMuted"}
      />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // The glyph sits centered on a 44pt target.
    tab: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: touchTarget,
      minWidth: bottomBar.tabWidth,
      paddingHorizontal: spacing.xs,
      borderRadius: radius,
    },
    tabPressed: {
      backgroundColor: colors.pressed,
    },
  }),
});
