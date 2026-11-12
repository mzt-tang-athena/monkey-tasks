/**
 * Palette data. This file imports nothing platform-specific, so a
 * contrast test can run it in node.
 */

/**
 * Themes as config. Named palettes from the round-2 verdicts plus one
 * dark port; screens read the active palette through useTheme and
 * useThemedStyles and never declare a raw color. Every palette shares
 * the same key set, so a screen is theme-agnostic by construction.
 */

export const THEMES = {
  /**
   * Budget green on paper. Deep green accent, the soft green sibling,
   * and a clean neutral warm white paper: the round-2 cream
   * desaturated until it stopped reading as "green eggs and ham".
   */
  budget: {
    paper: "#FAF7F0",
    surface: "#FFFDF7",
    pressed: "#F0EBDF",
    ink: "#26251E",
    inkMuted: "#686556",
    inkFaint: "#B5B1A2",
    hairline: "#E3DED1",
    accent: "#0F4031",
    accentDeep: "#0A3323",
    accentSoft: "#E2E7CE",
    focusRing: "#0F4031",
    danger: "#A8402F",
    dangerSoft: "#F4E3DD",
    onAccent: "#FAF7F0",
    scrim: "rgba(38,37,30,0.4)",
  },
  /** Todoist warm: the red-orange accent on crisp white. */
  todoist: {
    paper: "#FBFAF8",
    surface: "#FFFFFF",
    pressed: "#F2F0EC",
    ink: "#1F1E1C",
    inkMuted: "#6B665F",
    inkFaint: "#C4C0B9",
    hairline: "#E7E4DE",
    accent: "#C23A2D",
    accentDeep: "#A32C20",
    accentSoft: "#FBE9E5",
    focusRing: "#C23A2D",
    danger: "#8F2F21",
    dangerSoft: "#F6E0DC",
    onAccent: "#FFFFFF",
    scrim: "rgba(31,30,28,0.4)",
  },
  /** Quiet clay: variant F untouched, the muted terracotta on cream. */
  clay: {
    paper: "#F7F4E4",
    surface: "#FCFAF0",
    pressed: "#EFEAD6",
    ink: "#2E2A20",
    inkMuted: "#6E6656",
    inkFaint: "#B9B09C",
    hairline: "#E6DFC9",
    accent: "#985032",
    accentDeep: "#8A4529",
    accentSoft: "#F1E3D7",
    focusRing: "#985032",
    danger: "#8F3B2C",
    dangerSoft: "#F2E0DA",
    onAccent: "#FBF7ED",
    scrim: "rgba(46,42,32,0.45)",
  },
  /**
   * Midnight: the dark navy port of monkey-budget's `midnight` theme.
   * The ground and card values carry over. The palette keys map onto
   * that theme's foreground, muted-foreground, primary and border
   * tokens. The accent is light, so onAccent is the dark ground.
   */
  midnight: {
    paper: "#0B1220",
    surface: "#111A2E",
    pressed: "#182338",
    ink: "#EAF0FB",
    inkMuted: "#8FA3C4",
    inkFaint: "#63779C",
    hairline: "#2A3A57",
    accent: "#79CBE8",
    accentDeep: "#5CA8D6",
    accentSoft: "#1B2740",
    focusRing: "#79CBE8",
    danger: "#DE9188",
    dangerSoft: "#3A242B",
    onAccent: "#0B1220",
    scrim: "rgba(4,7,14,0.6)",
  },
} as const;

export type ThemeName = keyof typeof THEMES;

/** The name each palette shows on screen. A new palette cannot ship
    without a name. */
export const THEME_NAMES: Record<ThemeName, string> = {
  budget: "Budget",
  todoist: "Todoist",
  clay: "Clay",
  midnight: "Midnight",
};

/** The palette shape every theme shares; screens type against this. */
export type Palette = Record<keyof (typeof THEMES)["budget"], string>;
