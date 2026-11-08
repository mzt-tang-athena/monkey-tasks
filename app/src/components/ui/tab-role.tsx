import * as React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const web = Platform.OS === "web";

/**
 * Gesture handler 3.3.0's web Pressable presses only a view whose role
 * is "button" (`web/handlers/NativeViewGestureHandler.ts`, lines 87 to
 * 92). So on the web this view is the tab, around a Pressable that
 * stays a button. On native the Pressable is the tab. Spread
 * `tabRole(selected, label)` on the Pressable for either role. The view
 * takes the tab's layout style on both platforms, and the Pressable
 * fills it.
 */
export function TabRole({
  selected,
  label,
  style,
  children,
}: {
  selected: boolean;
  label: string | undefined;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return web ? (
    <View role="tab" aria-selected={selected} aria-label={label} style={style}>
      {children}
    </View>
  ) : (
    <View style={style}>{children}</View>
  );
}

export function tabRole(selected: boolean, label: string | undefined) {
  return web
    ? { role: "button" as const }
    : { role: "tab" as const, "aria-selected": selected, accessibilityLabel: label };
}

/** The Pressable's own style inside a `TabRole`. */
export const tabFill = StyleSheet.create({ fill: { flexGrow: 1 } }).fill;
