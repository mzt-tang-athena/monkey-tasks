import * as React from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

/**
 * The link between a pager and the chrome that tracks it: the page it
 * mounted on, its live position, the page it stands on, and whether a
 * finger owns it. The pager writes it and a surface reads it in a
 * worklet, so the chrome follows a swipe with no React re-render
 * (ADR 0046).
 */
export type PageFollow = {
  /** The page the pager mounted on, in tab or day indices. */
  origin: SharedValue<number>;
  /** The pager's live position from the origin, in pages. */
  progress: SharedValue<number>;
  /** The page the pager stands on, in pages from the origin. `progress`
      differs from it only while a finger or a settle moves the pager. */
  page: SharedValue<number>;
  /** 1 while a finger owns the pager, 0 otherwise. */
  touching: SharedValue<number>;
};

/** A page follow for a screen to hand to its pager and to its chrome.
    `start` is the page the screen opens on, so the chrome's first frame
    already stands there. */
export function usePageFollow(start = 0): PageFollow {
  const origin = useSharedValue(start);
  const progress = useSharedValue(0);
  const page = useSharedValue(0);
  const touching = useSharedValue(0);
  return React.useMemo(
    () => ({ origin, progress, page, touching }),
    [origin, progress, page, touching],
  );
}
