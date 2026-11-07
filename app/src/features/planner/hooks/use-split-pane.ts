/* eslint-disable react-hooks/refs -- the pan callbacks read the refs
when a gesture runs, not during render. */
import * as React from "react";
import { Gesture } from "react-native-gesture-handler";
import { drag } from "@/theme/tokens";

/** The divider's height: the dashed drop line and its grabber. */
export const dividerHeight = 28;

/**
 * The day's split: the timeline pane over the list pane, sized by the
 * grabber on the divider between them. This hook holds the sizes the
 * layout reports, the clamp, and the two ways to resize. The web path
 * reads pointer events through `begin`, `move` and `end`. The native
 * path is a pan that activates at once.
 *
 * `claim` runs when a resize starts, so the day swipe does not fire on
 * the same gesture.
 */
export function useSplitPane({ claim }: { claim: () => void }) {
  const [rootHeight, setRootHeight] = React.useState(0);
  // The pane's top edge inside the root: the pager's cell begins where
  // the body begins, below the stationary header, so the cell's offset
  // plus the split's own layout y gives root coordinates.
  const [bodyTop, setBodyTop] = React.useState(0);
  const [paneY, setPaneY] = React.useState(200);
  // The height the grabber chose, or null while it has not moved.
  const [chosen, setChosen] = React.useState<number | null>(null);
  const [resizing, setResizing] = React.useState(false);
  const [hot, setHot] = React.useState(false);
  const [grabbing, setGrabbing] = React.useState(false);

  // The divider may run until its bottom edge touches the root's
  // bottom edge, which is where the bottom bar begins, and never
  // past it.
  const maxTimeline = Math.max(
    rootHeight - (bodyTop + paneY) - dividerHeight,
    drag.minPane,
  );
  const clamp = React.useCallback(
    (grown: number) => Math.min(Math.max(grown, drag.minPane), maxTimeline),
    [maxTimeline],
  );
  // Until the grabber moves, the timeline takes its usual height, less
  // what the list pane needs to stay in reach on a short screen. The
  // layout has not reported yet while the root height is zero.
  const usual = 320;
  const timelineHeight =
    chosen != null
      ? Math.min(chosen, maxTimeline)
      : rootHeight === 0
        ? usual
        : Math.min(usual, Math.max(maxTimeline - drag.minPane, drag.minPane));

  // Gestures read the live values through refs, so their callbacks
  // keep one identity.
  const heightRef = React.useRef(timelineHeight);
  const clampRef = React.useRef(clamp);
  React.useEffect(() => {
    heightRef.current = timelineHeight;
    clampRef.current = clamp;
  }, [timelineHeight, clamp]);
  const start = React.useRef<{ y: number; height: number } | null>(null);
  // The day root's touch gate reads this: a resize owns the pointer.
  const busy = React.useRef(false);

  const begin = React.useCallback(
    (y: number) => {
      claim();
      start.current = { y, height: heightRef.current };
      busy.current = true;
      setResizing(true);
    },
    [claim],
  );
  /** True when a resize took the move. */
  const move = React.useCallback((y: number) => {
    const from = start.current;
    if (from == null) {
      return false;
    }
    setChosen(clampRef.current(from.height + (y - from.y)));
    return true;
  }, []);
  /** True when a resize was running. */
  const end = React.useCallback(() => {
    if (start.current == null) {
      return false;
    }
    start.current = null;
    busy.current = false;
    setResizing(false);
    return true;
  }, []);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        // Resizing reads refs and sets React state: JS thread only.
        .runOnJS(true)
        .minDistance(0)
        .onStart((e) => {
          // Resizing the split is not a swipe.
          claim();
          setGrabbing(true);
          start.current = { y: e.absoluteY, height: heightRef.current };
        })
        .onUpdate((e) => {
          move(e.absoluteY);
        })
        .onEnd(() => {
          start.current = null;
        })
        .onFinalize(() => {
          start.current = null;
          setGrabbing(false);
        }),
    [claim, move],
  );

  return React.useMemo(
    () => ({
      timelineHeight,
      /** A resize runs, by pointer or by pan. */
      active: resizing || grabbing,
      /** The grabber shows its hover look. */
      hot: hot || resizing || grabbing,
      setHot,
      busy,
      begin,
      move,
      end,
      pan,
      onRootLayout: setRootHeight,
      onBodyLayout: setBodyTop,
      onSplitLayout: setPaneY,
    }),
    [timelineHeight, resizing, grabbing, hot, begin, move, end, pan],
  );
}

export type SplitPane = ReturnType<typeof useSplitPane>;
