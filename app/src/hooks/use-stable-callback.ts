import * as React from "react";

/**
 * A function with one identity for the component's life that always
 * calls the latest `fn`. A memoized row can take it as a prop and never
 * re-render for it, while the function still reads the current state.
 * Call it from handlers and effects, never during render.
 */
export function useStableCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = React.useRef(fn);
  React.useLayoutEffect(() => {
    latest.current = fn;
  });
  return React.useCallback((...args: Args) => latest.current(...args), []);
}
