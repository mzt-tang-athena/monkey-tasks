/** A tab's place in its strip's content, in px. */
export type TabBox = { x: number; width: number };

/** The underline's box inside the strip's content, in px. */
export type UnderlineBox = { left: number; width: number };

/**
 * The underline's box for a page position. `page` is a tab index:
 * whole at rest, fractional between two tabs, so the bar blends from
 * one tab's place and width to the next. `inset` is the bar's gap from
 * each tab's edge. A missing box makes no bar.
 */
export function tabUnderline(
  boxes: readonly (TabBox | null)[],
  page: number,
  inset: number,
): UnderlineBox {
  "worklet";
  const last = boxes.length - 1;
  if (last < 0) {
    return { left: 0, width: 0 };
  }
  const at = Math.min(Math.max(page, 0), last);
  const low = Math.floor(at);
  const high = Math.min(low + 1, last);
  const share = at - low;
  const from = boxes[low];
  const to = boxes[high];
  if (from == null || to == null) {
    return { left: 0, width: 0 };
  }
  return {
    left: from.x + (to.x - from.x) * share + inset,
    width: Math.max(0, from.width + (to.width - from.width) * share - inset * 2),
  };
}
