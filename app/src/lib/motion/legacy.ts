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
