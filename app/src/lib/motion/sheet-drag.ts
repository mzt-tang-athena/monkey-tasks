import { motion } from "./tokens";

/**
 * A sheet drag's phases. A grab drags the panel. The release either
 * dismisses it or settles it back. A grab during the settle catches the
 * panel where it stands. A dismissed panel waits for the sheet to open
 * again.
 */
export type SheetDragPhase = "idle" | "dragging" | "settling" | "dismissing";

export type SheetDragEvent = "grab" | "dismiss" | "return" | "settled" | "reopen";

const transitions: Record<SheetDragPhase, Partial<Record<SheetDragEvent, SheetDragPhase>>> = {
  idle: { grab: "dragging", reopen: "idle" },
  dragging: { dismiss: "dismissing", return: "settling", reopen: "idle" },
  settling: { grab: "dragging", settled: "idle", reopen: "idle" },
  dismissing: { reopen: "idle" },
};

/** The phase after `event`, or null when the phase ignores it. */
export function sheetStep(
  phase: SheetDragPhase,
  event: SheetDragEvent,
): SheetDragPhase | null {
  "worklet";
  return transitions[phase][event] ?? null;
}

// A sheet commits on the same travel and the same flick as a page
// swipe, and an upward pull stretches as a page does at a closed end.
const { commit, flick, rubber, rubberMax } = motion.swipe;

/** The panel's offset for a finger `dy` px below where it grabbed. It
    follows the finger down and stretches upward. */
export function sheetFollow(dy: number): number {
  "worklet";
  return dy >= 0 ? dy : -Math.min(-dy * rubber, rubberMax);
}

/** What a release does. A drag past the threshold or a downward flick
    dismisses. A flick back up returns, however far the drag went. */
export function sheetRelease({ dy, vy }: { dy: number; vy: number }): "dismiss" | "return" {
  "worklet";
  if (dy <= 0 || vy <= -flick) {
    return "return";
  }
  return dy >= commit || vy >= flick ? "dismiss" : "return";
}
