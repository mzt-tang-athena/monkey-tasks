import * as React from "react";

/**
 * The Lists screen's selected tab, shared with the command pane. It is
 * screen state, not a saved setting: a reload opens on Main. The store
 * is module-level so the pane can switch a list from the Planner, and
 * a list note that vanishes falls back to Main at the reader.
 */
let selected = "Main";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Pick a list tab. Main is the catch-all. */
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
export function useSelectedList(): string {
  return React.useSyncExternalStore(subscribe, () => selected, () => selected);
}
