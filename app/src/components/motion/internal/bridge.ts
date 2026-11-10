import { scheduleOnRN } from "react-native-worklets";

/** Runs a plain JS function from a worklet. Every surface crosses to
    JS here, at a pickup, a drop, a cancel or a page commit. */
export function toJS<A extends unknown[]>(fn: (...args: A) => void, ...args: A): void {
  "worklet";
  scheduleOnRN(fn, ...args);
}

/**
 * The root's pickup guard. Each pickup carries a generation from the
 * UI thread. `token` is the open pickup, and it closes once, by a drop,
 * a cancel or the unmount, whichever comes first.
 */
export type BridgeGuard = {
  pickup: (generation: number) => boolean;
  settle: (generation: number) => boolean;
  close: () => boolean;
  fresh: (generation: number) => boolean;
};

export function createBridgeGuard(): BridgeGuard {
  let token: number | null = null;
  let generation = 0;
  return {
    pickup(next) {
      if (next <= generation) {
        return false;
      }
      generation = next;
      token = next;
      return true;
    },
    settle(of) {
      if (token !== of) {
        return false;
      }
      token = null;
      return true;
    },
    close() {
      if (token === null) {
        return false;
      }
      token = null;
      return true;
    },
    fresh(of) {
      return of === generation;
    },
  };
}
