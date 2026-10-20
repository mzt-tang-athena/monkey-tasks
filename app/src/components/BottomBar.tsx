import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radii } from "../theme/tokens";

/**
 * Variant E bottom bar: navigation only. The add button is gone; the
 * persistent inline composer above this bar carries capture.
 */
export function BottomBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 6 }]}>
      <IconTab
        label="Lists"
        active={pathname === "/"}
        onPress={() => router.navigate("/")}
        icon={<ListGlyph active={pathname === "/"} />}
      />
      <View style={styles.spring} />
      <IconTab
        label="Planner"
        active={pathname === "/planner"}
        onPress={() => router.navigate("/planner")}
        icon={<CalendarGlyph active={pathname === "/planner"} />}
      />
    </View>
  );
}

function IconTab({
  label,
  active,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {icon}
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Simple vectorless glyphs built from hairline views; no icon font. */
function ListGlyph({ active }: { active: boolean }) {
  const color = active ? colors.accent : colors.inkMuted;
  return (
    <View style={styles.glyphList}>
      <View style={[styles.glyphLine, { backgroundColor: color, width: 20 }]} />
      <View style={[styles.glyphLine, { backgroundColor: color, width: 14 }]} />
      <View style={[styles.glyphLine, { backgroundColor: color, width: 20 }]} />
    </View>
  );
}

function CalendarGlyph({ active }: { active: boolean }) {
  const color = active ? colors.accent : colors.inkMuted;
  return (
    <View style={[styles.glyphCalendar, { borderColor: color }]}>
      <View style={[styles.glyphCalendarTop, { backgroundColor: color }]} />
      <View style={[styles.glyphCalendarDot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    gap: spacing.s,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    minHeight: 40,
    paddingHorizontal: spacing.s,
    borderRadius: radii.m,
  },
  tabPressed: {
    backgroundColor: colors.pressed,
  },
  tabLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkMuted,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  spring: {
    flex: 1,
  },
  glyphList: {
    height: 12,
    alignItems: "flex-start",
    gap: 3,
  },
  glyphLine: {
    height: 2,
    borderRadius: 1,
  },
  glyphCalendar: {
    width: 17,
    height: 17,
    borderWidth: 1.5,
    borderRadius: 4,
    overflow: "hidden",
  },
  glyphCalendarTop: {
    height: 4,
    width: "100%" as const,
  },
  glyphCalendarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginLeft: 4,
    marginTop: 3,
  },
});
