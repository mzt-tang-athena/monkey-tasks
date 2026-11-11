import type { TaskItem } from "@/types/task";

/**
 * Pure updates on the cached row list. A row's `id` stays the same for
 * the whole session (ADR 0037): a screen, a route and a queued write
 * all find the row by it, while its `uri` can change under it.
 *
 * A write settles or rolls back a row only while the row still holds
 * the text that write put there. A later tap owns the row after that,
 * and its own write settles it. Nothing restores the whole list.
 */

/** The prefix of a row whose file does not exist yet. */
export const PENDING = "pending://";

let pendingSeq = 0;

/** A new provisional id, and uri, for a row whose file is not made yet. */
export function pendingId(): string {
  pendingSeq += 1;
  return `${PENDING}${pendingSeq}`;
}

export function rowById(
  rows: readonly TaskItem[],
  id: string,
): TaskItem | undefined {
  return rows.find((row) => row.id === id);
}

/** Change one row. The list keeps its identity when nothing changes. */
export function patchRow(
  rows: TaskItem[],
  id: string,
  change: (row: TaskItem) => TaskItem,
): TaskItem[] {
  let changed = false;
  const next = rows.map((row) => {
    if (row.id !== id) {
      return row;
    }
    const updated = change(row);
    changed ||= updated !== row;
    return updated;
  });
  return changed ? next : rows;
}

export function insertRow(rows: TaskItem[], row: TaskItem): TaskItem[] {
  return [...rows, row];
}

export function removeRow(rows: TaskItem[], id: string): TaskItem[] {
  const next = rows.filter((row) => row.id !== id);
  return next.length === rows.length ? rows : next;
}

/**
 * Land a write's result on its row. While the row still holds `text`,
 * the text the write's optimistic step put there, the result replaces
 * it. A row a later tap moved on keeps that tap's text, and only
 * follows the file: its uri and file name.
 */
export function settleRow(
  rows: TaskItem[],
  id: string,
  text: string,
  result: TaskItem,
): TaskItem[] {
  return patchRow(rows, id, (row) => {
    if (row.text === text) {
      return { ...result, id };
    }
    if (row.uri === result.uri && row.fileName === result.fileName) {
      return row;
    }
    return { ...row, uri: result.uri, fileName: result.fileName };
  });
}

/**
 * Undo a failed write's optimistic step on its row. Only a row that
 * still holds `text` changes. It takes back the content it had before,
 * and keeps its current uri, which a capture may have moved since.
 */
export function rollbackRow(
  rows: TaskItem[],
  id: string,
  text: string,
  previous: TaskItem,
): TaskItem[] {
  return patchRow(rows, id, (row) =>
    row.text === text
      ? { ...previous, id, uri: row.uri, fileName: row.fileName }
      : row,
  );
}

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
