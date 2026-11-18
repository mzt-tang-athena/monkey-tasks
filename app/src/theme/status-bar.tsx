import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/theme/theme-provider";
import type { ThemeName } from "@/theme/tokens";

/**
 * The system bar's icon colour for a palette. Midnight is the one dark
 * ground, so it is the one palette that needs light icons.
 */
export function statusBarStyle(name: ThemeName): "dark" | "light" {
  return name === "midnight" ? "light" : "dark";
}

/**
 * The status bar, in the active palette's icon colour. It sits above
 * every screen, so a theme switch repaints the icons in place.
 */
export function ThemedStatusBar() {
  const { name } = useTheme();
  return <StatusBar style={statusBarStyle(name)} />;
}
