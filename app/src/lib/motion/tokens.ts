import { Easing } from "react-native-reanimated";

/** How a drag source waits before it lifts: a row inside a scroller, a
    pill in free space, or a grip that lifts at once. */
export type HoldKind = "row" | "pill" | "grip";

export const motion = {
  ms: {
    tap: 120,
    return: 180,
    settle: 220,
    landing: 220,
    tickWash: 320,
    landWash: 600,
    sheet: 220,
    menu: 140,
    longPress: 450,
  },
  /** Elements entering decelerate into place. One curve for the app. */
  easeOut: Easing.bezier(0.16, 1, 0.3, 1),
  /** A surface that slides into place settles on this spring. */
  spring: {
    pane: { damping: 22, stiffness: 240, mass: 0.9 },
  },
  /** The distance and the speed a pull must reach to act. */
  pull: {
    activate: 12,
    commit: 56,
    /** The pane's top block sits at the edge, so a close pull is shorter. */
    close: 24,
    failX: 24,
  },
  swipe: {
    slop: 12,
    commit: 80,
    /** px/s. A release this fast turns the page under the threshold. */
    flick: 500,
    rubber: 0.28,
    rubberMax: 48,
  },
  hold: {
    row: 300,
    pill: 120,
    grip: 0,
    /** The hold tint waits this long, so a scroll fails the pan first. */
    cue: 80,
    slop: 8,
  },
  split: {
    minPane: 150,
  },
} as const;

/** The browser keeps the pans a hold kind leaves free, so a row in a
    scroller still scrolls and a grip claims every touch. */
export const holds: Record<HoldKind, { ms: number; touchAction: "pan-y" | "none" }> = {
  row: { ms: motion.hold.row, touchAction: "pan-y" },
  pill: { ms: motion.hold.pill, touchAction: "pan-y" },
  grip: { ms: motion.hold.grip, touchAction: "none" },
};
