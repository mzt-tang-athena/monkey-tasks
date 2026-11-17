/**
 * The split's clamp. The top pane keeps its own floor and leaves the
 * bottom pane its floor. When the two floors do not fit, the top pane
 * wins, as it did before the surface existed.
 */
export function clampTop(
  top: number,
  usable: number,
  minTop: number,
  minBottom: number,
): number {
  "worklet";
  const low = Math.max(minTop, 0);
  return Math.min(Math.max(top, low), Math.max(usable - minBottom, low));
}

/** The same clamp, as the top pane's share of the usable height. */
export function clampFraction(
  fraction: number,
  usable: number,
  minTop: number,
  minBottom: number,
): number {
  "worklet";
  if (usable <= 0) {
    return fraction;
  }
  return clampTop(fraction * usable, usable, minTop, minBottom) / usable;
}
