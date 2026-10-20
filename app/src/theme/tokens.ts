import { Platform } from "react-native";

/**
 * Variant E design tokens: "Todoist warm". Crisp, very slightly warm
 * white paper; one red-orange accent (Todoist family, tuned warm);
 * muted warm gray text hierarchy. Typography and hairlines carry the
 * layout, not borders or cards. Every screen reads from here; no
 * component declares a raw color.
 */
export const theme = {
  colors: {
    /** Screen background: crisp white with a faint warm cast. */
    paper: "#FBFAF8",
    /** Field, bar, and floating surfaces: pure white. */
    surface: "#FFFFFF",
    /** Pressed rows, recessed trays, and segmented tracks. */
    pressed: "#F3F0EB",
    /** Near-black warm ink for primary text. */
    ink: "#3A3529",
    /** Secondary text: muted warm gray. */
    inkMuted: "#8D887B",
    /** Faded text: done rows, disabled controls. */
    inkFaint: "#C7C2B6",
    /** Hairline separators: the quietest warm gray. */
    hairline: "#ECE9E2",
    /** The single accent: Todoist-family red-orange, tuned warm. */
    accent: "#DC4C3E",
    /** Accent tint for selected chips, fills, and drop targets. */
    accentSoft: "#FAECE9",
    /** Overdue and errors: deeper brick, distinct from the accent. */
    danger: "#9C3A24",
    /** Danger tint for overdue badges. */
    dangerSoft: "#F7E7E1",
    /** Text and icons on accent fills: plain white. */
    onAccent: "#FFFFFF",
  },
  fonts: {
    /** Serif display face: the date header only, the one warm gesture. */
    display: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, 'Times New Roman', serif",
    }),
    /** Body sans: tasks, labels, controls on web. */
    body: Platform.select({
      web: "-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    }) as string | undefined,
  },
  /** 4pt scale, dense: half steps are the working units. */
  spacing: {
    xs: 4,
    s: 8,
    m: 12,
    l: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  radii: {
    s: 4,
    m: 8,
    l: 12,
    pill: 999,
  },
} as const;

export const { colors, fonts, spacing, radii } = theme;
