import * as React from "react";

/**
 * The Lists screen's selected tab, shared with the command pane. It is
 * screen state, not a saved setting. `null` means the user has not
 * picked a tab yet, so the screen opens on the first tab, which is
 * Today while it is on and Main when it is off (ADR 20261125-today-list).
 * The store is module-level so the pane can switch a list from the
 * Planner, and a tab that is not in the strip falls back to the first
 * one at the reader.
 */
let selected: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Pick a list tab. Main is the unfiled bucket. */
export function selectList(name: string): void {
  if (selected === name) {
    return;
  }
  selected = name;
  for (const listener of listeners) {
    listener();
  }
}

/** The selected list tab, live across every reader. */
export function useSelectedList(): string | null {
  return React.useSyncExternalStore(subscribe, () => selected, () => selected);
}
