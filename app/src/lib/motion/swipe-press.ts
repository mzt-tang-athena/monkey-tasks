import { canGo, follow, type PageBounds } from "./pager-math";
import { motion } from "./tokens";

/**
 * What a finger, a key or a screen reader asks of a bar action: the
 * commands, the tab on either side, or the button's own action. `none`
 * is a gesture that committed nothing to do.
 */
export type SwipeAction = "commands" | "next" | "previous" | "press" | "none";

/**
 * The action a release asks for. A swipe down opens the commands. A
 * rightward swipe goes to the next tab, as sliding the selection along
 * the bar would, and a leftward one to the previous tab. The ends hold.
 * A gesture that stays under the commit is the button's own press, so a
 * tap that moved a little still acts.
 *
 * The commit is the button's own, a third of the pager's, because the
 * button is 44 points tall at the window's edge: a finger there has
 * about 30 points of room below it. A quick throw still counts under
 * the distance, at the pager's flick.
 */
export function swipeAction({
  dx,
  dy,
  vx,
  vy,
  at,
  bounds,
}: {
  /** The finger's travel, in points. */
  dx: number;
  dy: number;
  /** The finger's speed at release, in points a second. */
  vx: number;
  vy: number;
  /** The page the bar stands on, counted from the first. */
  at: number;
  bounds: PageBounds;
}): SwipeAction {
  "worklet";
  const commit = motion.addButton.commit;
  const flick = motion.swipe.flick;
  if (Math.abs(dx) > Math.abs(dy)) {
    const step = dx > 0 ? 1 : -1;
    const past = Math.abs(dx) >= commit;
    const flung = Math.abs(vx) >= flick && (vx > 0 ? 1 : -1) === step;
    if (!past && !flung) {
      return "press";
    }
    // A page the bar cannot reach is no press: the finger meant to move.
    if (!canGo(bounds, at + step)) {
      return "none";
    }
    return step === 1 ? "next" : "previous";
  }
  if (dy <= 0) {
    return dy < 0 && dy <= -commit ? "none" : "press";
  }
  return dy >= commit || vy >= flick ? "commands" : "press";
}

/**
 * The button's own travel under the finger: a damped follow, capped, so
 * a swipe reads as a swipe before it commits. A sideways move past a
 * closed end rubber bands, as the pager does. An upward move asks for
 * nothing, so the button holds still.
 */
export function swipeNudge({
  dx,
  dy,
  at,
  bounds,
}: {
  dx: number;
  dy: number;
  at: number;
  bounds: PageBounds;
}): { x: number; y: number } {
  "worklet";
  const share = follow(dx, bounds, at, "right") * motion.addButton.share;
  const x = Math.min(Math.max(share, -motion.addButton.nudge), motion.addButton.nudge);
  const down = Math.min(Math.max(dy, 0) * motion.addButton.share, motion.addButton.nudge);
  return { x, y: down };
}
