import * as React from "react";

/**
 * The Snooze button on a reminder, waiting for its sheet. The button
 * opens the app and the response reaches the root layout, which sits
 * above the host that draws the sheet, so the request waits here. A
 * tap that starts the app sets it before the host mounts.
 */
export type SnoozeRequest = {
  uri: string;
  /** The alarm minute the pressed ring belongs to. */
  base?: number;
  /** The task's name. */
  name: string;
  /** Names the press, so each choice claims its own key. */
  key: string;
};

let current: SnoozeRequest | null = null;
const listeners = new Set<() => void>();

function publish(next: SnoozeRequest | null): void {
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

export function requestSnooze(request: SnoozeRequest): void {
  publish(request);
}

export function clearSnoozeRequest(): void {
  if (current != null) {
    publish(null);
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSnoozeRequest(): SnoozeRequest | null {
  return React.useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
