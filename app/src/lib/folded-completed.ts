import * as React from "react";

/**
 * The list tabs whose Completed group shows its rows. It is screen
 * state, not a saved setting: the app starts with every tab folded, and
 * a reload folds them again. The store is module-level so the live list
 * and the swipe preview of the same tab agree.
 */
const open = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Open or fold the Completed group of one tab. */
export function setCompletedOpen(tab: string, openNow: boolean): void {
  if (open.has(tab) === openNow) {
    return;
  }
  if (openNow) {
    open.add(tab);
  } else {
    open.delete(tab);
  }
  for (const listener of listeners) {
    listener();
  }
}

/** Open or fold the Completed group of one tab. */
export function toggleCompleted(tab: string): void {
  setCompletedOpen(tab, !open.has(tab));
}

/** Whether the tab's Completed group shows its rows now. */
export function useCompletedOpen(tab: string): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => open.has(tab),
    () => open.has(tab),
  );
}
