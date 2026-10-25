import type { TaskItem } from "../tasks/query";

export type OrderChange = { task: TaskItem; order: number };

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
  if (from === to || to === from + 1) {
    return [];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved == null) {
    return [];
  }
  next.splice(to > from ? to - 1 : to, 0, moved);
  return next.flatMap((task, index) => {
    const order = index + 1;
    return task.data?.order === order ? [] : [{ task, order }];
  });
}
