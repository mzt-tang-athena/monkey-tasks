import * as React from "react";
import { Platform } from "react-native";

/**
 * The control that opened a surface, so a close puts focus back. On
 * the web it reads `document.activeElement` on the frame the surface
 * opens and focuses it again when the surface closes (ADR 0040). A
 * phone's screen reader owns focus there, so this does nothing.
 */
export function useOpenerFocus(open: boolean): void {
  const opener = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    if (Platform.OS !== "web" || !open) {
      return;
    }
    opener.current = document.activeElement as HTMLElement | null;
    return () => {
      const target = opener.current;
      opener.current = null;
      // The screen is inert until the host's own layout effect clears
      // it, so the focus waits one microtask.
      queueMicrotask(() => target?.focus?.());
    };
  }, [open]);
}
