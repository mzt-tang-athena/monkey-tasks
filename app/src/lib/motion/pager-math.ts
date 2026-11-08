import { motion } from "./tokens";

/** The pages a pager may show. A missing end is open. */
export type PageBounds = { first?: number; last?: number };

const { commit, flick, rubber, rubberMax } = motion.swipe;

/** Whether `page` lies inside the bounds. */
export function canGo(bounds: PageBounds, page: number): boolean {
  "worklet";
  return (
    (bounds.first === undefined || page >= bounds.first) &&
    (bounds.last === undefined || page <= bounds.last)
  );
}

/** How far the track moves for a finger travel of `dx`. Toward a page
    it follows the finger. Past a closed end it stretches a little. */
export function follow(dx: number, bounds: PageBounds, page: number): number {
  "worklet";
  const toward = page + (dx < 0 ? 1 : -1);
  if (dx === 0 || canGo(bounds, toward)) {
    return dx;
  }
  return Math.sign(dx) * Math.min(Math.abs(dx) * rubber, rubberMax);
}

/** The page step a release lands on: 1 for the next page, -1 for the
    previous one, 0 to return. A drag past the threshold or a flick
    commits. A flick back returns, unless the drag passed half the
    width. */
export function releaseTarget({
  dx,
  vx,
  width,
  bounds,
  page,
}: {
  dx: number;
  vx: number;
  width: number;
  bounds: PageBounds;
  page: number;
}): -1 | 0 | 1 {
  "worklet";
  const drag = dx < 0 ? 1 : dx > 0 ? -1 : 0;
  const thrown = Math.abs(vx) >= flick ? (vx < 0 ? 1 : -1) : 0;
  let step: -1 | 0 | 1 = 0;
  if (Math.abs(dx) >= width / 2) {
    step = drag;
  } else if (thrown !== 0) {
    step = thrown === drag ? drag : 0;
  } else if (Math.abs(dx) >= commit) {
    step = drag;
  }
  return step !== 0 && canGo(bounds, page + step) ? step : 0;
}

/** The pages on screen when the track stands at `pos`, in pages. A
    remainder under half a pixel counts as rest. */
export function visiblePages(pos: number, width: number): number[] {
  "worklet";
  const nearest = Math.round(pos);
  if (Math.abs(pos - nearest) * width < 0.5) {
    return [nearest];
  }
  const low = Math.floor(pos);
  return [low, low + 1];
}
