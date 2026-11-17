import * as React from "react";
import { Platform } from "react-native";

/**
 * Arrow keys on a focused control, for the web. `onArrow` takes 1 for
 * the up or right arrow and -1 for down or left, so each control can
 * map the arrow to its own step. A screen reader's increment and
 * decrement actions call that step on a phone.
 */
export function useArrowKeys(
  ref: React.RefObject<unknown>,
  onArrow: (direction: 1 | -1) => void,
): void {
  // The listener attaches once. A step that changes with the value
  // would otherwise leave a frame with no listener while it resubscribes.
  const latest = React.useRef(onArrow);
  React.useLayoutEffect(() => {
    latest.current = onArrow;
  });
  React.useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    // The listener sits on the document, because the ref may not hold
    // its node yet. It checks the focus at key time instead.
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement !== ref.current) {
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowRight") {
        event.preventDefault();
        latest.current(1);
      } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        event.preventDefault();
        latest.current(-1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ref]);
}
