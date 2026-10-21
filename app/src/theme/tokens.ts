import { Platform } from "react-native";

/**
 * Themes as config. Three named palettes from the round-2 verdicts;
 * screens read the one exported `activeTheme` and never declare a
 * raw color. Every palette shares the same key set, so a screen is
 * theme-agnostic by construction.
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
    inkMuted: "#7D7A6C",
    inkFaint: "#B5B1A2",
    hairline: "#E3DED1",
    accent: "#0F4031",
    accentDeep: "#0A3323",
    accentSoft: "#E2E7CE",
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
    inkMuted: "#827D76",
    inkFaint: "#C4C0B9",
    hairline: "#E7E4DE",
    accent: "#DC4C3E",
    accentDeep: "#C23A2D",
    accentSoft: "#FBE9E5",
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
    inkMuted: "#8B8271",
    inkFaint: "#B9B09C",
    hairline: "#E6DFC9",
    accent: "#A65B3B",
    accentDeep: "#8F4A2F",
    accentSoft: "#F1E3D7",
    danger: "#8F3B2C",
    dangerSoft: "#F2E0DA",
    onAccent: "#FBF7ED",
    scrim: "rgba(46,42,32,0.45)",
  },
} as const;

export type ThemeName = keyof typeof THEMES;

/** The palette shape every theme shares; screens type against this. */
export type Palette = Record<keyof (typeof THEMES)["budget"], string>;

/**
 * The active theme: registry default, or a dev-only override set from
 * the dev route's switcher (web storage, read once at module load).
 */
function activeThemeName(): ThemeName {
  const names = Object.keys(THEMES) as ThemeName[];
  try {
    const saved = globalThis.localStorage?.getItem("dev-theme");
    if (saved != null && names.includes(saved as ThemeName)) {
      return saved as ThemeName;
    }
  } catch {
    // No storage (native or blocked): fall through to the default.
  }
  return "budget";
}

export const activeTheme = THEMES[activeThemeName()];

/** Switch the dev theme and reload, so module constants re-read. */
export function setDevTheme(name: ThemeName): void {
  try {
    globalThis.localStorage?.setItem("dev-theme", name);
  } catch {
    // Ignore: the swatch is dev-only decoration without storage.
  }
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export const colors: Palette = activeTheme;

export const fonts = {
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
};

/** 8pt scale, with the half steps 4pt and 12pt. */
export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * The one shared corner radius for every surface: cards, cells,
 * buttons, the composer panel. Round 5 shaved it a step. The fully
 * rounded capture pill is the only exception.
 */
export const radius = 6;
/** Floating surfaces (the capture sheet) sit a step larger. */
export const radiusFloating = radius + 4;
export const radii = { pill: 999 } as const;

/**
 * Day-spread drag physics: pointer travel that promotes a press into
 * a drag, and how small either pane of the split may go.
 */
export const drag = {
  threshold: 8,
  minPane: 150,
  holdMs: 450,
} as const;

/** Reading measure: screens cap their content width on wide screens. */
export const measure = 720;

/**
 * Week mode's day-column width. Sized so a 390pt phone still shows
 * two full columns plus a third peeking on a 350pt viewport after
 * the page gutters: 2 x 144 + 2 x 8 gaps + ~22 sliver. Tune the
 * token, the arithmetic follows.
 */
export const weekColWidth = 144;

/**
 * The period strip's scroll step: one strip pill plus one gap. Keep
 * in sync with the styles: stripDay is 44 wide and the rail gap is
 * spacing.s. The rail alignment math consumes this.
 */
export const periodStep = 52;

/** The page's side margin, shared by every screen. */
export const pageGutter = 20;

/**
 * The capture panel's internal rhythm: clear air between the input,
 * the parse line, and the action row.
 */
export const sheetGap = 12;

/**
 * The capture input grows with its text. Growth stops at this share
 * of the window height: below it the panel breathes upward with the
 * wraps, past it the input scrolls inside its own box. Native text
 * inputs grow by themselves, so the cap is what keeps a long capture
 * from swallowing the page.
 */
export const sheetMaxShare = 0.4;
