import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../theme/tokens";

/**
 * Variant B capture affordance: instead of a floating button, a slim
 * full-width bottom bar. Tab icons sit on the left, the round add
 * button on the right. Both screens mount one.
 */
export function BottomBar({ onAdd }: { onAdd: () => void }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      <IconTab
        label="Lists"
        active={pathname === "/"}
        onPress={() => router.navigate("/")}
        icon={<ListGlyph active={pathname === "/"} />}
      />
      <IconTab
        label="Planner"
        active={pathname === "/planner"}
        onPress={() => router.navigate("/planner")}
        icon={<CalendarGlyph active={pathname === "/planner"} />}
      />
      <View style={styles.spring} />
      <Pressable
        style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
        onPress={onAdd}
        accessibilityLabel="add a task"
        accessibilityRole="button"
      >
        <Text style={styles.addGlyph}>+</Text>
      </Pressable>
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

/** Simple vecless glyphs built from hairline views; no icon font. */
function ListGlyph({ active }: { active: boolean }) {
  const color = active ? colors.accent : colors.inkMuted;
  return (
    <View style={styles.glyphList}>
      <View style={[styles.glyphLine, { backgroundColor: color, width: 22 }]} />
      <View style={[styles.glyphLine, { backgroundColor: color, width: 16 }]} />
      <View style={[styles.glyphLine, { backgroundColor: color, width: 22 }]} />
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
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
    gap: spacing.m,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: spacing.s,
    borderRadius: spacing.m,
  },
  tabPressed: {
    backgroundColor: colors.pressed,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkMuted,
    marginTop: 3,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  spring: {
    flex: 1,
  },
  add: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addPressed: {
    opacity: 0.7,
  },
  addGlyph: {
    color: colors.onAccent,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "400",
    marginTop: -2,
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
    width: 18,
    height: 18,
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
    marginTop: 4,
  },
});
