import * as React from "react";
import {
  ReduceMotion,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { motion } from "./tokens";

/** A timing to `to` on the app's curve. `done` is a plain JS function.
    It runs only when the animation finishes, and with reduced motion
    that is at once. */
export function timing(to: number, ms: number, done?: () => void) {
  "worklet";
  return withTiming(
    to,
    { duration: ms, easing: motion.easeOut, reduceMotion: ReduceMotion.System },
    (finished) => {
      "worklet";
      if (finished === true && done !== undefined) {
        scheduleOnRN(done);
      }
    },
  );
}

/** A spring to `to`. `done` works as in `timing`. */
export function spring(to: number, config: WithSpringConfig, done?: () => void) {
  "worklet";
  return withSpring(
    to,
    { ...config, reduceMotion: ReduceMotion.System },
    (finished) => {
      "worklet";
      if (finished === true && done !== undefined) {
        scheduleOnRN(done);
      }
    },
  );
}

declare const progressBrand: unique symbol;

/** A 0 to 1 value that only `useProgress` writes. Animated styles read
    `.value`. */
export type Progress = { readonly value: number; readonly [progressBrand]: true };

/**
 * The one clock that React drives. It runs from where it stands to
 * `target` over `ms`. `onSettled(at)` runs once per run, when it
 * finishes or at unmount. A new target before the end supersedes the
 * run, and the old run's `onSettled` never runs. The first value is
 * the target, with no run. With reduced motion every run lands at once.
 */
export function useProgress(
  target: boolean,
  { ms, onSettled }: { ms: number; onSettled?: (at: 0 | 1) => void },
): Progress {
  const to = target ? 1 : 0;
  const value = useSharedValue(to);
  const reduced = useReducedMotion();
  const settled = React.useRef(onSettled);
  React.useLayoutEffect(() => {
    settled.current = onSettled;
  });
  // The run in flight: its number and end, or null once it settled.
  const run = React.useRef<{ id: number; at: 0 | 1 } | null>(null);
  const runs = React.useRef(0);
  const started = React.useRef(to);

  const settle = React.useCallback((id: number) => {
    const current = run.current;
    if (current === null || current.id !== id) {
      return;
    }
    run.current = null;
    settled.current?.(current.at);
  }, []);

  React.useLayoutEffect(() => {
    if (started.current === to) {
      return;
    }
    started.current = to;
    runs.current += 1;
    const id = runs.current;
    run.current = { id, at: to };
    if (reduced) {
      value.value = to;
      settle(id);
      return;
    }
    value.value = timing(to, ms, () => settle(id));
  }, [to, ms, reduced, value, settle]);

  React.useEffect(
    () => () => {
      const current = run.current;
      if (current !== null) {
        settle(current.id);
      }
    },
    [settle],
  );

  return value as unknown as Progress;
}
