import { Platform } from "react-native";

/**
 * Variant F design tokens: "Quiet custom". The custom-color answer:
 * one owned, low-saturation warm clay accent, no borrowed brand hue.
 * The accent sits at OKLCH(0.60 0.08 50), a muted terracotta that
 * reads clearly on cream paper without shouting. Spacing is the 8pt
 * scale stretched one step further than Variant B: this is the most
 * generous of the round-2 variants. Every screen reads from here; no
 * component declares a raw color.
 */
export const theme = {
  colors: {
    /** Screen background: cream paper from the #F7F4D5 family, toned towards ivory. */
    paper: "#F7F4E4",
    /** Card and bar surfaces: a half-step brighter than paper. */
    surface: "#FCFAF0",
    /** Pressed rows and recessed fills. */
    pressed: "#EFEAD6",
    /** Near-black warm ink for primary text. */
    ink: "#2E2A20",
    /** Secondary text: warm gray-brown. */
    inkMuted: "#8B8271",
    /** Faded text: done rows, disabled controls. */
    inkFaint: "#B9B09C",
    /** Hairline separators and card borders. */
    hairline: "#E6DFC9",
    /** The single quiet accent: muted warm clay, owned not borrowed. */
    accent: "#A65B3B",
    /** Accent tint for selected chips, fills, and drop targets. */
    accentSoft: "#F1E3D7",
    /** Overdue and errors: deep oxblood, distinct from the clay accent. */
    danger: "#8F3B2C",
    /** Danger tint for overdue badges. */
    dangerSoft: "#F2E0DA",
    /** Text and icons on accent fills. */
    onAccent: "#FBF7ED",
    /** Translucent ink veil behind modal sheets. */
    scrim: "rgba(46, 42, 32, 0.45)",
  },
  fonts: {
    /** Serif display face: date headers only, strongest in this variant. */
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
  /** The 8pt scale, stretched: two extra steps for group air. */
  spacing: {
    xs: 4,
    s: 8,
    m: 12,
    l: 16,
    xl: 24,
    xxl: 32,
    /** Extra air between groups; this variant's signature gap. */
    air: 40,
    xxxl: 48,
  },
  radii: {
    s: 8,
    m: 12,
    l: 20,
    pill: 999,
  },
} as const;

export const { colors, fonts, spacing, radii } = theme;
