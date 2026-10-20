import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { t } from "../theme/tokens";

/**
 * The bottom navbar, taken from the user's dark notes-app reference:
 * a flat bar, quiet labels with a small active dot, and the round
 * capture button on the right side.
 */
export type NavbarTab = "lists" | "planner";

export function BottomNavbar({
  active,
  onCapture,
}: {
  active: NavbarTab;
  onCapture: () => void;
}) {
  const router = useRouter();
  return (
    <View style={styles.navbar}>
      <NavbarItem
        label="Lists"
        onPress={() => router.navigate("/")}
        active={active === "lists"}
      />
      <NavbarItem
        label="Planner"
        onPress={() => router.navigate("/planner")}
        active={active === "planner"}
      />
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={onCapture}
        accessibilityLabel="add a task"
        accessibilityRole="button"
      >
        <Text style={styles.plus}>+</Text>
      </Pressable>
    </View>
  );
}

function NavbarItem({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>
        {label}
      </Text>
      {active ? <View style={styles.itemDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    flexDirection: "row",
    alignItems: "center",
    height: 76,
    paddingHorizontal: t.spacing.xl,
    gap: t.spacing.xl,
  },
  item: {
    alignItems: "center",
    gap: t.spacing.xs,
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.xs,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: t.colors.textMuted,
    fontFamily: t.fonts.sans,
  },
  itemLabelActive: {
    color: t.colors.text,
  },
  itemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.accent,
  },
  fab: {
    marginLeft: "auto",
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: t.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  fabPressed: {
    backgroundColor: t.colors.accentDeep,
  },
  plus: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "400",
    color: t.colors.onAccent,
  },
});
