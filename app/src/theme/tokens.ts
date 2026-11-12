import { Platform, type TextStyle, type ViewStyle } from "react-native";
import { motion } from "@/lib/motion/tokens";

export {
  THEMES,
  THEME_NAMES,
  type Palette,
  type ThemeName,
} from "@/theme/palettes";

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

/**
 * The type scale, named by role (ADR 0040). Each step is a size and
 * the line height that goes with it. A style spreads a step and adds
 * its own color and, where it needs one, a weight:
 * `{ ...type.meta, color: palette.inkMuted }`. The eyebrow is a whole
 * form, so it carries its weight, tracking and case too.
 */
export const type = {
  /** Small caps over a group: section and field labels. */
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  /** The smallest text: chips, week cards, ruler marks. */
  caption: { fontSize: 11, lineHeight: 14, fontFamily: fonts.body },
  /** Secondary lines: a row's time, banners, hints. */
  meta: { fontSize: 13, lineHeight: 18, fontFamily: fonts.body },
  /** Labels on things you press: buttons, menu items, pills. */
  control: { fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
  /** Running text and field values. */
  body: { fontSize: 16, lineHeight: 22, fontFamily: fonts.body },
  /** Task names, list tabs and the capture input. */
  bodyLarge: { fontSize: 17, lineHeight: 24, fontFamily: fonts.body },
  /** A screen's own heading, such as the note title in the editor. */
  title: { fontSize: 22, lineHeight: 28, fontFamily: fonts.body },
  /** The serif date on the day view. */
  display: { fontSize: 26, lineHeight: 32, fontFamily: fonts.display },
} as const satisfies Record<string, TextStyle>;

/**
 * One z scale for every surface that floats (ADR 0040). Without it,
 * floating surfaces stack in tree order, and `elevation` reorders
 * them on Android only. `OverlayHost` draws each overlay at its
 * layer, with the same number as its Android elevation.
 */
export const layers = {
  content: 0,
  bottomBar: 10,
  dragGhost: 20,
  menuBackdrop: 30,
  menu: 40,
  sheetScrim: 50,
  sheet: 60,
  toast: 70,
} as const;

export type Layer = keyof typeof layers;

/**
 * Shadows for surfaces that float above the page. `floating` is the
 * menu, sheet and toast. `lifted` is a row under the finger.
 */
export const shadows = {
  floating: {
    // Black in every palette. On the dark ground the elevation is what
    // reads, not the shadow tone.
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  lifted: {
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const satisfies Record<string, ViewStyle>;

/**
 * Layout steps on a 4pt grid. A container spaces its children with one
 * step (ADR 0012), and a layout value at or above 4 belongs on the
 * scale, so a button pads with `m`, not 10.
 *
 * Marks under 4 stay literal: a tick, a hairline gap or a glyph stroke
 * traces a shape, not a rhythm. No step exists between 4 and 8, so 6
 * rounds to one of them rather than growing the scale.
 */
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
 * The one shared corner radius for every laid-out surface: cards,
 * cells, buttons, the composer panel. Round 5 shaved it a step.
 *
 * Marks under 4 stay literal: they trace a glyph or a swatch, not a
 * panel. A shape that must read as fully round uses `radii.pill`,
 * whatever its size. A drawn glyph may also carry its own curve, and
 * the layout guard allowlists each one.
 */
export const radius = 6;
/** Floating surfaces (the capture sheet) sit a step larger. */
export const radiusFloating = radius + 4;
export const radii = { pill: 999 } as const;

/**
 * Day-spread drag physics: pointer travel that promotes a press into
 * a drag, and how small either pane of the split may go. Each value
 * comes from the motion tokens. The port that removes the last user
 * deletes this.
 */
export const drag = {
  threshold: motion.hold.slop,
  minPane: motion.split.minPane,
  /** Touch pickups wait out this hold; scrolling never gets hijacked. */
  pickMs: motion.hold.row,
  /** The pills row has free space to scroll from, so its pickup is
      quicker than a row inside a scrolling pane. */
  pillPickMs: motion.hold.pill,
} as const;

/** Reading measure: screens cap their content width on wide screens. */
export const measure = 720;

/**
 * Week mode's day-column width and canvas height. Sized so a 390pt
 * phone shows two full columns plus a third peeking after the page
 * gutters; the canvas height caps the columns so tall viewports do
 * not stretch them into the bottom section's space.
 */
export const weekColWidth = 144;
export const weekCanvasHeight = 256;

/**
 * The period strip's scroll step: one strip pill plus one gap. Keep
 * in sync with the styles: stripDay is 44 wide and the rail gap is
 * spacing.s. The rail alignment math consumes this.
 */
export const periodStep = 52;

/** The page's side margin, shared by every screen. */
export const pageGutter = 20;

/** The smallest touch target the platform guidance allows. */
export const touchTarget = 44;

/** Every menu's width: the widest item label fits on one line. */
export const menuWidth = 216;

/**
 * The bottom bar's rhythm: a taller row, a 44pt nav target, and a
 * 48pt Add control that reads as the primary action.
 */
export const bottomBar = {
  row: 52,
  tabWidth: 56,
  add: 48,
  glyph: 20,
  labelSize: 12,
  labelLine: 16,
  addLabelSize: 16,
  addLabelLine: 22,
} as const;

/**
 * The capture input: larger than a list row, with line height that
 * keeps a wrapped capture readable.
 */
export const captureText = {
  size: 17,
  line: 24,
  minHeight: 52,
} as const;

/**
 * Room the capture panel leaves for the keyboard and its own fixed
 * chrome, so a long capture still fits a 568pt screen. About 260pt of
 * keyboard, 116pt of panel chrome and an 8pt gutter.
 */
export const sheetReserve = 400;

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
