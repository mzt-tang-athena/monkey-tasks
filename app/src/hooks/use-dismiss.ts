import * as React from "react";
import { BackHandler, Platform } from "react-native";

type Dismiss = { current: () => void };

/**
 * The web's open surfaces, newest last. Android calls the newest back
 * listener first. A browser calls key listeners oldest first, so one
 * shared listener hands Escape to the newest surface instead.
 */
const escapeStack: Dismiss[] = [];

function onEscape(event: KeyboardEvent) {
  if (event.key !== "Escape") {
    return;
  }
  escapeStack[escapeStack.length - 1]?.current();
}

/**
 * Closes a floating surface on the platform's own "go back" key:
 * Android back on the phone, Escape in the browser. It listens only
 * while `active` is true. One key press closes one surface, the one
 * that opened last: a menu inside a sheet closes, and the sheet stays.
 */
export function useDismiss(active: boolean, onDismiss: () => void): void {
  const latest = React.useRef(onDismiss);
  React.useEffect(() => {
    latest.current = onDismiss;
  }, [onDismiss]);

  React.useEffect(() => {
    if (!active) {
      return;
    }
    if (Platform.OS === "web") {
      if (typeof document === "undefined") {
        return;
      }
      escapeStack.push(latest);
      // The capture phase: a focused text input on the web stops
      // keydown from bubbling, and Escape must still reach the stack.
      if (escapeStack.length === 1) {
        document.addEventListener("keydown", onEscape, true);
      }
      return () => {
        escapeStack.splice(escapeStack.indexOf(latest), 1);
        if (escapeStack.length === 0) {
          document.removeEventListener("keydown", onEscape, true);
        }
      };
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        latest.current();
        return true;
      },
    );
    return () => subscription.remove();
  }, [active]);
}
