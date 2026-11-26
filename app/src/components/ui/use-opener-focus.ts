import * as React from "react";
import { Platform } from "react-native";

/**
 * The control that opened a surface, so a close puts focus back. On
 * the web it reads `document.activeElement` on the frame the surface
 * opens and focuses it again when the surface closes (ADR 0040). A
 * phone's screen reader owns focus there, so this does nothing.
 *
 * A surface with a better place for focus after it closes passes
 * `returnFocus`, which runs instead on every platform. The capture
 * sheet's reference picker gives the caret back to the task input this
 * way, so the keyboard stays up.
 */
export function useOpenerFocus(
  open: boolean,
  returnFocus?: () => void,
): void {
  const opener = React.useRef<HTMLElement | null>(null);
  const restore = React.useRef(returnFocus);
  React.useLayoutEffect(() => {
    restore.current = returnFocus;
  }, [returnFocus]);
  React.useLayoutEffect(() => {
    if (!open) {
      return;
    }
    if (Platform.OS === "web") {
      opener.current = document.activeElement as HTMLElement | null;
    }
    return () => {
      const target = opener.current;
      const to = restore.current;
      opener.current = null;
      // The screen is inert until the host's own layout effect clears
      // it, so the focus waits one microtask.
      queueMicrotask(() => (to != null ? to() : target?.focus?.()));
    };
  }, [open]);
}
