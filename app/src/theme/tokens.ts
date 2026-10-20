import { Platform } from "react-native";

/**
 * Variant B design tokens: "Notebook calm". Warm paper surfaces, warm
 * ink, one sage accent. Every screen reads from here; no component
 * declares a raw color.
 */
export const theme = {
  colors: {
    /** Screen background: warm cream paper, not gray-white. */
    paper: "#F7F2E7",
    /** Card and bar surfaces: a half-step brighter than paper. */
    surface: "#FFFDF6",
    /** Pressed rows and recessed fills. */
    pressed: "#EFE8D8",
    /** Near-black warm ink for primary text. */
    ink: "#2B261D",
    /** Secondary text: warm gray-brown. */
    inkMuted: "#8A8070",
    /** Faded text: done rows, disabled controls. */
    inkFaint: "#B7AD9B",
    /** Hairline separators and card borders. */
    hairline: "#E4DCC8",
    /** The single quiet accent: muted sage green. */
    accent: "#4E6B54",
    /** Accent tint for selected chips and fills. */
    accentSoft: "#E6EBE2",
    /** Overdue and errors: warm rust, never pure red. */
    danger: "#A8402F",
    /** Danger tint for overdue badges. */
    dangerSoft: "#F4E3DD",
    /** Text and icons on accent fills. */
    onAccent: "#FBF8EF",
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
} as const;

export const { colors, fonts, spacing, radii } = theme;
