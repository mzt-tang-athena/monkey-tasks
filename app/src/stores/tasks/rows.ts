import type { TaskItem } from "@/types/task";

/**
 * Pure updates on the cached row list. A row's `id` stays the same for
 * the whole session (ADR 0037): a screen, a route and a queued write
 * all find the row by it, while its `uri` can change under it.
 */

/**
 * Give each row of a new read the id of the old row with the same uri.
 * A read names a row by its uri, so without this a captured row would
 * lose its provisional id, and a renamed row its first id, and an open
 * editor would lose its task.
 *
 * Ids stay unique. A note that takes the uri a renamed row once had
 * gets a new id, because the renamed row keeps that one.
 */
export function carryIds(
  old: readonly TaskItem[] | undefined,
  next: TaskItem[],
): TaskItem[] {
  if (old == null || old.length === 0) {
    return next;
  }
  const idByUri = new Map(old.map((row) => [row.uri, row.id]));
  const carried = new Set<string>();
  for (const row of next) {
    const id = idByUri.get(row.uri);
    if (id != null) {
      carried.add(id);
    }
  }
  let changed = false;
  const rows = next.map((row) => {
    const id = idByUri.get(row.uri);
    if (id === row.id || (id == null && !carried.has(row.id))) {
      return row;
    }
    changed = true;
    return { ...row, id: id ?? freshId(row.id, carried) };
  });
  return changed ? rows : next;
}

function freshId(base: string, taken: Set<string>): string {
  let count = 2;
  while (taken.has(`${base}#${count}`)) {
    count += 1;
  }
  const id = `${base}#${count}`;
  taken.add(id);
  return id;
}
