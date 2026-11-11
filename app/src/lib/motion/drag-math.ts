/** A box in page coordinates, as `measure()` gives `pageX` and
    `pageY`. The gesture's `absoluteX` and `absoluteY` share the space. */
export type Rect = { x: number; y: number; width: number; height: number };

/** A row's place in its group, from a measure at pickup. */
export type RowSpan = { top: number; height: number };

/** A drop zone at pickup. `clip` names the scroller it sits in, or -1. */
export type ZoneRect = Rect & { id: number; clip: number };

/** A grid zone: one rect cut into `columns` by `rows` cells, read left
    to right, top to bottom. A `null` cell is no target. */
export type GridRect = ZoneRect & {
  columns: number;
  rows: number;
  cells: readonly (number | null)[];
};

/** A hit: the zone's id, and the cell for a grid or -1. */
export type Hit = { id: number; cell: number };

export type CardPosition = "first" | "middle" | "last" | "only";

/** The row the finger is over. Rows run top down. A gap belongs to
    the row above it. */
export function slotForY(y: number, rows: readonly RowSpan[]): number {
  "worklet";
  let slot = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].top <= y) {
      slot = i;
    }
  }
  return slot;
}

/** Where each row sits once `order` is laid out from the first top
    with `gap` between rows. `order` lists row indexes in their new
    order. The result is indexed by row. */
export function slotTops(
  order: readonly number[],
  rows: readonly RowSpan[],
  gap: number,
): number[] {
  "worklet";
  const tops: number[] = rows.map(() => 0);
  let y = Infinity;
  for (const row of rows) {
    y = Math.min(y, row.top);
  }
  if (rows.length === 0) {
    return tops;
  }
  for (let k = 0; k < order.length; k++) {
    const index = order[k];
    tops[index] = y;
    y += rows[index].height + gap;
  }
  return tops;
}

/** The data indexes a drop writes. `from` and `to` are mount
    positions: the picked row's, and the boundary it lands on. `indexes`
    holds each mounted row's index in its group's data, top down. Null
    when the group mounted no row, so there is nothing to move. */
export function dropSpan(
  from: number,
  to: number,
  indexes: readonly number[],
): { from: number; to: number } | null {
  "worklet";
  const mounted = indexes.length;
  if (from < 0 || from >= mounted) {
    return null;
  }
  return {
    from: indexes[from],
    to: to >= mounted ? indexes[mounted - 1] + 1 : indexes[to],
  };
}

/** The index in its group's data that each mounted row shows its card
    by after the drop. The result is indexed by mount position. */
export function slotIndexes(
  from: number,
  to: number,
  indexes: readonly number[],
): number[] {
  "worklet";
  const out = indexes.slice();
  const span = dropSpan(from, to, indexes);
  if (span === null) {
    return out;
  }
  const landed = span.to > span.from ? span.to - 1 : span.to;
  for (let i = 0; i < indexes.length; i += 1) {
    const at = indexes[i];
    if (i === from) {
      out[i] = landed;
    } else if (at > span.from && at <= landed) {
      out[i] = at - 1;
    } else if (at >= landed && at < span.from) {
      out[i] = at + 1;
    }
  }
  return out;
}

function inside(x: number, y: number, rect: Rect): boolean {
  "worklet";
  return (
    x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
  );
}

/** The target under the finger. A zone counts only inside its clip.
    Where zones nest, the smaller one wins. */
export function hitZone(
  x: number,
  y: number,
  zones: readonly ZoneRect[],
  grids: readonly GridRect[],
  clips: Readonly<Record<number, Rect>>,
): Hit | null {
  "worklet";
  let best: Hit | null = null;
  let bestArea = Infinity;
  const visible = (zone: ZoneRect) => {
    "worklet";
    const clip = clips[zone.clip];
    return inside(x, y, zone) && (zone.clip === -1 || clip === undefined || inside(x, y, clip));
  };
  for (const zone of zones) {
    const area = zone.width * zone.height;
    if (area < bestArea && visible(zone)) {
      best = { id: zone.id, cell: -1 };
      bestArea = area;
    }
  }
  for (const grid of grids) {
    const area = grid.width * grid.height;
    if (area >= bestArea || !visible(grid)) {
      continue;
    }
    const column = Math.floor(((x - grid.x) * grid.columns) / grid.width);
    const row = Math.floor(((y - grid.y) * grid.rows) / grid.height);
    const cell = row * grid.columns + column;
    if (grid.cells[cell] != null) {
      best = { id: grid.id, cell };
      bestArea = area;
    }
  }
  return best;
}

/** Where row `index` of `count` sits in its card. */
export function cardPosition(index: number, count: number): CardPosition {
  "worklet";
  if (count <= 1) {
    return "only";
  }
  if (index === 0) {
    return "first";
  }
  return index === count - 1 ? "last" : "middle";
}
