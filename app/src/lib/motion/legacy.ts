import * as React from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";
import { parseStoredDate } from "@/utils/dates";

/**
 * The system's reduce motion switch. Every animation in the app reads
 * it: with the switch on, the end state applies at once and nothing
 * moves. Kept current, so the setting applies without a reload.
 */
/** The browser's answer at mount; native answers asynchronously. */
function readReduceMotion(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return false;
  }
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function useReduceMotion(): boolean {
  const [reduced, setReduced] = React.useState(readReduceMotion);
  React.useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.matchMedia) {
        return;
      }
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (live) {
        setReduced(on);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** Elements entering decelerate into place. One curve for the app. */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** How young a task is when its row rises in on mount. The parser
    drops the seconds a created stamp carries, so the window has to
    cover the whole minute plus the current one. */
const freshMs = 90_000;

/**
 * The entrance for a row that appeared moments ago: it rises and fades
 * in where it will live, instead of appearing under the finger. An
 * older row starts at rest.
 */
export function useRise(created: string | undefined): Animated.Value {
  const reduced = useReduceMotion();
  const [entry] = React.useState(() => {
    const at = created ? parseStoredDate(created) : null;
    const fresh = at != null && Date.now() - at.date.getTime() < freshMs;
    return { fresh, rise: new Animated.Value(fresh ? 0 : 1) };
  });
  React.useEffect(() => {
    if (!entry.fresh) {
      return;
    }
    if (reduced) {
      entry.rise.setValue(1);
      return;
    }
    Animated.timing(entry.rise, {
      toValue: 1,
      duration: 180,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [entry, reduced]);
  return entry.rise;
}

/**
 * A menu's entrance: 0 to 1 over 140 ms when it opens, at once with
 * reduced motion. The menu fades and grows from its corner on this
 * one value. It is today's code from the planner's source menu, kept
 * behind this hook so ticket 0058 can swap it for Reanimated.
 */
export function useMenuEntrance(open: boolean): Animated.Value {
  const reduced = useReduceMotion();
  const [progress] = React.useState(() => new Animated.Value(0));
  React.useEffect(() => {
    if (!open) {
      progress.setValue(0);
      return;
    }
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 140,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [open, progress, reduced]);
  return progress;
}

/**
 * A sheet's travel: 0 closed to 1 open over 220 ms, the clock the
 * bottom bar runs today. `onClosed` runs when the exit has played, so
 * the caller can unmount the sheet then and not on a timer. Ticket
 * 0062 moves the sheet onto the keyboard's own clock.
 */
export function useSheetMotion(
  open: boolean,
  onClosed: () => void,
): Animated.Value {
  const reduced = useReduceMotion();
  const [progress] = React.useState(() => new Animated.Value(0));
  const closed = React.useRef(onClosed);
  React.useEffect(() => {
    closed.current = onClosed;
  }, [onClosed]);
  React.useEffect(() => {
    if (reduced) {
      progress.setValue(open ? 1 : 0);
      if (!open) {
        closed.current();
      }
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && !open) {
        closed.current();
      }
    });
    return () => animation.stop();
  }, [open, progress, reduced]);
  return progress;
}

export type Shake = {
  /** The offset to apply as a translateX. */
  offset: Animated.Value;
  /** Play the shake, unless motion is reduced. */
  start: () => void;
};

/**
 * A light shake: the readiness cue when a hold completes. It never
 * runs with reduce motion on.
 */
export function useShake(): Shake {
  const reduced = useReduceMotion();
  const [offset] = React.useState(() => new Animated.Value(0));
  const reducedRef = React.useRef(reduced);
  React.useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  const start = React.useCallback(() => {
    offset.stopAnimation();
    if (reducedRef.current) {
      offset.setValue(0);
      return;
    }
    const step = (toValue: number, duration: number) =>
      Animated.timing(offset, {
        toValue,
        duration,
        useNativeDriver: Platform.OS !== "web",
      });
    Animated.sequence([
      step(-2.5, 40),
      step(2.5, 50),
      step(-1.5, 50),
      step(0, 40),
    ]).start();
  }, [offset]);

  return { offset, start };
}
