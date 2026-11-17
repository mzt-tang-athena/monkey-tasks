import * as React from "react";

/**
 * Asks whichever mounted capture dock has focus to open its sheet. The
 * command pane draws above the whole stack and owns no capture state,
 * so the focused tab's dock is the one that answers. Only one dock is
 * focused at a time; the rest are idle tabs.
 */
const handlers = new Set<() => void>();

/** Open the capture sheet on the focused screen. */
export function requestCapture(): void {
  for (const handler of handlers) {
    handler();
  }
}

/** Answer a capture request while this dock's tab shows. */
export function useCaptureRequest(handler: () => void): void {
  const latest = React.useRef(handler);
  React.useLayoutEffect(() => {
    latest.current = handler;
  });
  React.useEffect(() => {
    const answer = () => latest.current();
    handlers.add(answer);
    return () => {
      handlers.delete(answer);
    };
  }, []);
}
