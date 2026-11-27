import * as React from "react";
import { Platform } from "react-native";

const isArrowKey = (key: string) => key.startsWith("Arrow");
const isActivateKey = (key: string) => key === "Enter" || key === " ";

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
  useFocusKeys(ref, (key) => {
    if (key === "ArrowUp" || key === "ArrowRight") {
      onArrow(1);
    } else if (key === "ArrowDown" || key === "ArrowLeft") {
      onArrow(-1);
    }
  });
}

/**
 * Arrow keys on a focused control, for the web, as the swipes a bar
 * action takes: down for the commands, left and right for a tab. A
 * browser keyboard reaches every job of the target. A phone's hardware
 * keyboard has no key event in React Native, so TalkBack's custom
 * actions carry the same three jobs there.
 */
export function useSwipeKeys(
  ref: React.RefObject<unknown>,
  onStep: (step: "commands" | "next" | "previous") => void,
): void {
  useFocusKeys(ref, (key) => {
    if (key === "ArrowDown") {
      onStep("commands");
    } else if (key === "ArrowRight") {
      onStep("next");
    } else if (key === "ArrowLeft") {
      onStep("previous");
    }
  });
}

/** Enter and Space on a focused control, for the web: a press. */
export function useActivateKeys(
  ref: React.RefObject<unknown>,
  onActivate: () => void,
): void {
  useFocusKeys(ref, () => onActivate(), isActivateKey);
}

/** Runs `onKey` for a key `wanted` accepts while `ref` holds the focus.
    It takes the arrow keys unless told otherwise. */
function useFocusKeys(
  ref: React.RefObject<unknown>,
  onKey: (key: string) => void,
  wanted: (key: string) => boolean = isArrowKey,
): void {
  // The listener attaches once. A step that changes with the value
  // would otherwise leave a frame with no listener while it resubscribes.
  const latest = React.useRef(onKey);
  React.useLayoutEffect(() => {
    latest.current = onKey;
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
      if (!wanted(event.key)) {
        return;
      }
      event.preventDefault();
      latest.current(event.key);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ref, wanted]);
}
