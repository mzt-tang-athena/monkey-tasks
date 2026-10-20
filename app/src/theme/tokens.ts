/**
 * Theme tokens for design variant A (Todoist density).
 *
 * The single source for every color, font, spacing, and radius value
 * in this variant. Components import from here only. No raw hex or
 * pixel magic numbers inside components.
 *
 * The palette is deliberately quiet: a near-white cool paper, one
 * blue accent, and two muted text levels. Red is reserved for past
 * due work. Nothing else shouts.
 */
export const theme = {
  colors: {
    /** Screen background. */
    paper: "#F7F8FA",
    /** Cards, sheets, inputs. */
    surface: "#FFFFFF",
    /** Primary text. */
    text: "#20262E",
    /** Secondary text: due info, counts, previews. */
    textMuted: "#77808B",
    /** Tertiary text: completed names, disabled labels. */
    textFaint: "#AAB2BC",
    /** The single accent. Links, active states, checked circles, FAB. */
    accent: "#2B6CE0",
    /** Accent when pressed. */
    accentPressed: "#2057BE",
    /** Soft blue tint for pressed rows and selected chips. */
    accentSoft: "#EDF2FB",
    /** Past due text and group header. */
    danger: "#B3261E",
    /** Positive confirmations, for example a parsed due date. */
    success: "#188038",
    /** Hairlines and input borders. */
    border: "#E4E8ED",
    /** Stronger outlines: unchecked circles, chips. */
    borderStrong: "#C7CED8",
    /** Modal backdrop. */
    scrim: "rgba(23, 27, 33, 0.4)",
    /** Text on accent surfaces. */
    onAccent: "#FFFFFF",
    /** FAB and sheet shadows. */
    shadow: "rgba(23, 27, 33, 0.18)",
  },
  /** One font family. Headers are upright system type; emphasis is weight. */
  fonts: {
    regular: "System",
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  /** Type ramp. Small sizes, strong weight hierarchy. */
  type: {
    micro: { fontSize: 11, lineHeight: 14 },
    small: { fontSize: 13, lineHeight: 17 },
    body: { fontSize: 15, lineHeight: 20 },
    title: { fontSize: 17, lineHeight: 22 },
    display: { fontSize: 24, lineHeight: 30 },
  },
  /** 4pt spacing scale. */
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
  },
  radii: {
    sm: 6,
    md: 10,
    lg: 16,
    pill: 100,
    /** Floating action button radius (56 / 2). */
    fab: 28,
  },
} as const;
