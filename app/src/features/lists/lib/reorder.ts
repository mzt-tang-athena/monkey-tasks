import type { TaskItem } from "@/types/task";

export type OrderChange = { task: TaskItem; order: number };

/**
 * The sequence with the item at `from` placed before the item at `to`.
 * `to === from` and `to === from + 1` mean "stay put".
 */
export function moveItem(
  items: TaskItem[],
  from: number,
  to: number,
): TaskItem[] {
  if (from === to || to === from + 1) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved == null) {
    return items;
  }
  next.splice(to > from ? to - 1 : to, 0, moved);
  return next;
}

/**
 * Move the item at `from` so it lands before the item at `to`, then
 * return the `order` writes the new sequence needs: positions 1..n,
 * and only the tasks whose value changes. `to === from` and
 * `to === from + 1` are no-ops, because both mean "stay put".
 */
export function reorderItems(
  items: TaskItem[],
  from: number,
  to: number,
): OrderChange[] {
  return moveItem(items, from, to).flatMap((task, index) => {
    const order = index + 1;
    return task.data?.order === order ? [] : [{ task, order }];
  });
}

/**
 * Where each row sits once `order` is laid out from the section's top,
 * using the heights measured at pickup. The reorder animates a row
 * from its old place to its new one with this.
 */
export function layoutOrder(
  order: TaskItem[],
  rects: { uri: string; y: number; h: number }[],
  gap = 0,
): Map<string, number> {
  const heights = new Map(rects.map((rect) => [rect.uri, rect.h]));
  let y = rects.length > 0 ? Math.min(...rects.map((rect) => rect.y)) : 0;
  const out = new Map<string, number>();
  order.forEach((task, index) => {
    out.set(task.uri, y);
    y += (heights.get(task.uri) ?? 0) + (index < order.length - 1 ? gap : 0);
  });
  return out;
}
