/** A cell's place in its row, in px. */
export type MarkPlace = { x: number; width: number };

/** A mark's box inside the row's content, in px. */
export type MarkBox = { left: number; width: number };

/**
 * The box a mark takes at `at`: a tab index or a period index. Whole at
 * rest, fractional between two cells, so the mark blends from one
 * cell's place and width to the next. `inset` is the mark's gap from
 * each cell's edge. A missing place makes no mark.
 */
export function markBetween(
  places: readonly (MarkPlace | null)[],
  at: number,
  inset: number,
): MarkBox {
  "worklet";
  const last = places.length - 1;
  if (last < 0) {
    return { left: 0, width: 0 };
  }
  const page = Math.min(Math.max(at, 0), last);
  const low = Math.floor(page);
  const high = Math.min(low + 1, last);
  const share = page - low;
  const from = places[low];
  const to = places[high];
  if (from == null || to == null) {
    return { left: 0, width: 0 };
  }
  return {
    left: from.x + (to.x - from.x) * share + inset,
    width: Math.max(0, from.width + (to.width - from.width) * share - inset * 2),
  };
}
