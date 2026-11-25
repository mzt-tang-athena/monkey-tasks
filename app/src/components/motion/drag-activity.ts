import * as React from "react";

/**
 * Which surfaces hold a finger now. A reorder surface marks itself
 * while a row is lifted, and the pager under it keeps its page. The
 * Board and the lists each own a surface, so the counter is a set: a
 * second surface mounting cannot clear the first one's mark.
 */
const active = new Set<number>();
let next = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): boolean {
  return active.size > 0;
}

/** A surface's own id, for its mount's life. */
export function nextSurfaceId(): number {
  next += 1;
  return next;
}

/** Mark a surface dragged or released. */
export function markSurfaceDragging(id: number, on: boolean): void {
  if (active.has(id) === on) {
    return;
  }
  if (on) {
    active.add(id);
  } else {
    active.delete(id);
  }
  for (const listener of listeners) {
    listener();
  }
}

/** Whether any surface holds a finger now. */
export function useSurfaceDragging(): boolean {
  return React.useSyncExternalStore(subscribe, snapshot, snapshot);
}
