import { Platform } from "react-native";

/**
 * Variant D design tokens: "Budget green on paper". The monkey-budget
 * palette as the accent seed: one deep green on warm cream paper, a
 * muted warm red for overdue only. A's row density with B's paper
 * warmth. Every screen reads from here; no component declares a raw
 * color.
 */
export const theme = {
  colors: {
    /** Screen background: warm cream paper from the budget palette. */
    paper: "#F7F4D5",
    /** Bars and raised surfaces: a half-step brighter than paper. */
    surface: "#FCFAE6",
    /** Pressed rows and recessed fills, including the tray well. */
    pressed: "#EDEAC6",
    /** Near-black warm ink for primary text. */
    ink: "#262B20",
    /** Secondary text: warm gray-green. */
    inkMuted: "#7C816C",
    /** Faded text: done rows, disabled controls. */
    inkFaint: "#B2B59C",
    /** Hairline separators and field borders. */
    hairline: "#E0DDb8",
    /** The single accent: budget deep green. */
    accent: "#0F4031",
    /** Pressed accent fills: the deep sibling. */
    accentDeep: "#0A3323",
    /** Lighter sibling for soft fills and selected chips. */
    accentSoft: "#E2E7CE",
    /** Overdue and errors: muted warm red, never pure red. */
    danger: "#A8402F",
    /** Danger tint for overdue badges. */
    dangerSoft: "#F4E3DD",
    /** Text and icons on accent fills. */
    onAccent: "#F7F4D5",
    /** Modal backdrop: ink at 40 percent. */
    scrim: "rgba(38,43,32,0.4)",
  },
  fonts: {
    /** Serif display face: date headers only. */
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
  /** 8pt scale, with the half steps 4pt and 12pt. */
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
    s: 6,
    m: 10,
    l: 16,
    pill: 999,
  },
  /** Reading measure: screens cap their content width on wide screens. */
  measure: 720,
} as const;

export const { colors, fonts, spacing, radii, measure } = theme;
