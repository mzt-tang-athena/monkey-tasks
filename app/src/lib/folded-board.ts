import * as React from "react";

/**
 * The Board's folded columns. Done and Dropped start folded, as a list
 * tab's Completed does, and a press opens one column alone. It is
 * screen state, not a saved setting: a reload folds them again. The
 * store is module-level so the live board and the swipe preview of the
 * same column agree.
 */
let open: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): ReadonlySet<string> {
  return open;
}

/** Open or fold one board column. */
export function setBoardGroupOpen(status: string, openNow: boolean): void {
  if (open.has(status) === openNow) {
    return;
  }
  const next = new Set(open);
  if (openNow) {
    next.add(status);
  } else {
    next.delete(status);
  }
  open = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Open or fold one board column. */
export function toggleBoardGroup(status: string): void {
  setBoardGroupOpen(status, !open.has(status));
}

/** The columns that show their rows now. */
export function useBoardFoldOpen(): ReadonlySet<string> {
  return React.useSyncExternalStore(subscribe, snapshot, snapshot);
}
