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

/** The data indexes a drop writes, read again from the group as it
    stands at the drop. `keys` is the pickup's row keys, top down, and
    `live` maps each row of the group to its data index now. `from` and
    `to` are slots in `keys`: the picked row's, and the boundary it lands
    on.

    The picked row and the row the boundary names keep their identity,
    so a row that left the group since pickup (a tick's regroup) moves
    nobody. Null when the drop has lost the row it moves, or a row that
    stood between the others, because the span then names places the
    user never saw. */
export function rebaseSpan(
  from: number,
  to: number,
  keys: readonly string[],
  live: Readonly<Record<string, number>>,
): { from: number; to: number } | null {
  const mounted = keys.length;
  if (from < 0 || from >= mounted) {
    return null;
  }
  const picked = live[keys[from]];
  if (picked === undefined) {
    return null;
  }
  let previous = -1;
  for (let i = 0; i < mounted; i += 1) {
    const at = live[keys[i]];
    if (at === undefined) {
      continue;
    }
    if (at <= previous) {
      return null;
    }
    previous = at;
  }
  // The row that stood below the boundary, or the first of those still
  // here. With nothing below it, the drop lands after the last row.
  let anchor = -1;
  for (let i = to; i < mounted; i += 1) {
    const at = live[keys[i]];
    if (at !== undefined) {
      anchor = at;
      break;
    }
  }
  if (anchor !== -1) {
    return { from: picked, to: anchor };
  }
  for (let i = Math.min(to, mounted) - 1; i >= 0; i -= 1) {
    const at = live[keys[i]];
    if (at !== undefined) {
      return { from: picked, to: at + 1 };
    }
  }
  return null;
}
