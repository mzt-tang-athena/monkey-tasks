import { Platform } from "react-native";

/**
 * Design variant C, "Dark studio".
 *
 * The single source of truth for color, type, spacing and radius.
 * Components read from this object and hard code nothing: values
 * live here or nowhere.
 */
export const theme = {
  colors: {
    /** Page background: deep near-black, never pure black. */
    surface: "#141417",
    /** Cards, sheets and the navbar sit one step up. */
    surfaceRaised: "#1D1D22",
    /** Fill for pressed and selected elements. */
    surfaceActive: "#26262D",
    /** Wells that recede: input fields, segmented tracks. */
    surfaceSunken: "#0F0F12",
    /** Hairline and card borders. */
    border: "#2B2B32",
    /** Stronger border for focus and control rings. */
    borderStrong: "#3E3E48",
    text: "#ECE9E2",
    textMuted: "#9B978F",
    textFaint: "#6B6862",
    /** The one warm accent: amber. */
    accent: "#E3A45C",
    /** Amber, held back for small indicators. */
    accentDeep: "#8A6534",
    /** Muted danger red for overdue markers. */
    danger: "#CE7B70",
    success: "#8FAE8B",
    /** Text drawn on the accent fill. */
    onAccent: "#171310",
    /** Scrim behind modal sheets. */
    scrim: "rgba(6,6,8,0.62)",
  },
  fonts: {
    /** Geometric sans for headings and task names. */
    sans: Platform.select({
      web: "'Inter', 'Segoe UI', system-ui, sans-serif",
      default: "sans-serif",
    }),
    /** Mono is reserved for times; it is the studio signature. */
    mono: Platform.select({
      web: "'IBM Plex Mono', 'Roboto Mono', Menlo, monospace",
      default: "monospace",
    }),
  },
  spacing: { px: 1, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const,
  radii: { sm: 8, md: 12, lg: 16, pill: 999 } as const,
};

/** Short alias used across components. */
export const t = theme;
