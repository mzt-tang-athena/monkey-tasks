import * as React from "react";
import { StyleSheet, Text } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import { TabRole, tabFill, tabRole } from "@/components/ui/tab-role";
import {
  bottomBar,
  colors,
  fonts,
  radius,
  spacing,
  touchTarget,
} from "@/theme/tokens";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * One nav item of the bottom bar: the icon over its label. Weight and
 * color carry the selection, with no dot.
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
  return (
    <TabRole selected={active} label={label}>
      <Pressable
        style={({ pressed }) => [tabFill, styles.tab, pressed && styles.tabPressed]}
        onPress={onPress}
        {...tabRole(active, label)}
      >
        <Icon name={icon} color={active ? "accent" : "inkMuted"} />
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </Pressable>
    </TabRole>
  );
}

const styles = StyleSheet.create({
  // The icon over its label, one small step apart.
  tab: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: touchTarget,
    minWidth: bottomBar.tabWidth,
    paddingHorizontal: spacing.xs,
    borderRadius: radius,
  },
  tabPressed: {
    backgroundColor: colors.pressed,
  },
  label: {
    fontSize: bottomBar.labelSize,
    lineHeight: bottomBar.labelLine,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  labelActive: {
    color: colors.accent,
    fontWeight: "600",
  },
});
