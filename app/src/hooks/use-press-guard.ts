import * as React from "react";

/** How long a press stays blocked after a gesture ends, in ms. */
export const pressGuardMs = 350;

export type PressGuard = {
  /** A gesture that is not a press has started: a drag that was
      picked up. */
  arm: () => void;
  /** The gesture ended. A click that follows it is still blocked. */
  release: () => void;
  /** Should this press be ignored? A press that the guard blocks after
      the gesture ended uses the guard up, so the next one goes through. */
  blocked: () => boolean;
};

export function makePressGuard(now: () => number = Date.now): PressGuard {
  let armed = false;
  let until = 0;
  return {
    arm() {
      armed = true;
    },
    release() {
      armed = false;
      until = now() + pressGuardMs;
    },
    blocked() {
      if (armed) {
        return true;
      }
      if (now() < until) {
        until = 0;
        return true;
      }
      return false;
    },
  };
}

/**
 * Stops the click that ends a drag from also pressing the row under
 * the pointer. On the web the browser sends a click after pointer up,
 * even when the pointer travelled. A drag arms the guard when it ends,
 * and a row press asks `blocked()` first. Ticket 0060 moves the last
 * user onto the reorder surface and deletes this hook.
 */
export function usePressGuard(): PressGuard {
  const [guard] = React.useState(() => makePressGuard());
  return guard;
}
