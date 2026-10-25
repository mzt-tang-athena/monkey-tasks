/* eslint-disable react-hooks/refs -- the controller's callbacks read
the refs when the gesture runs, not during render. */
import * as React from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { easeOut, useReduceMotion } from "../lib/motion";
import {
  makeSwipeController,
  type SwipeController,
} from "../lib/swipe";

/** How far a page follows when there is no neighbour, in px. */
const rubberMax = 48;
/** The rubber band's share of the finger travel. */
const rubberShare = 0.28;

export type PagerSide = "left" | "right";

export type SwipePagerOptions = {
  /** The page identity. The offset resets when this changes, before
      paint, so the next page appears in place. */
  pageKey: string;
  /** Is there a page in this direction? Without one, the page only
      rubber-bands and returns. */
  canGo: (dir: PagerSide) => boolean;
  /** Commit the page change. `pageKey` must change with it. */
  onPage: (dir: PagerSide) => void;
  /** The neighbour page, mounted only while a finger travels toward
      it. It sits in a fixed cell, so the current page never remounts. */
  renderNeighbor: (dir: PagerSide) => React.ReactNode;
  /** The current page. */
  children: React.ReactNode;
};

export type SwipePager = {
  /** Hand this to `swipeProps`, wherever the gesture should live. */
  controller: SwipeController;
  /** The paged content: current page plus the neighbour cell. */
  page: React.ReactNode;
};

/**
 * A horizontal pager that shows the page beside the current one. The
 * track holds three fixed cells, previous, current, next, so the
 * current page keeps its identity and its scroll position for the
 * whole gesture. Only the neighbour the finger travels toward is
 * mounted, and only while it travels.
 */
export function useSwipePager({
  pageKey,
  canGo,
  onPage,
  renderNeighbor,
  children,
}: SwipePagerOptions): SwipePager {
  const reduced = useReduceMotion();
  const [offset] = React.useState(() => new Animated.Value(0));
  // The neighbour remembers which page it belongs to. A commit changes
  // the key, so the neighbour is gone in the same render, with no
  // effect and no frame of the old page.
  const [neighbor, setNeighbor] = React.useState<{
    dir: PagerSide;
    key: string;
  } | null>(null);
  const side = neighbor != null && neighbor.key === pageKey ? neighbor.dir : null;
  // The window width seeds the first frame, so the current page is
  // never painted into a zero-width viewport. The viewport's own
  // measurement replaces it before a finger can arrive.
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = React.useState(windowWidth);
  const pageKeyRef = React.useRef(pageKey);
  const neighborRef = React.useRef(neighbor);
  const widthRef = React.useRef(0);
  const canGoRef = React.useRef(canGo);
  const onPageRef = React.useRef(onPage);
  const reducedRef = React.useRef(reduced);
  React.useEffect(() => {
    pageKeyRef.current = pageKey;
    neighborRef.current = neighbor;
    widthRef.current = width;
    canGoRef.current = canGo;
    onPageRef.current = onPage;
    reducedRef.current = reduced;
  });

  const back = React.useCallback(() => {
    offset.stopAnimation();
    setNeighbor(null);
    if (reducedRef.current) {
      offset.setValue(0);
      return;
    }
    Animated.timing(offset, {
      toValue: 0,
      duration: 180,
      easing: easeOut,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [offset]);

  const [controller] = React.useState(() =>
    makeSwipeController(() => undefined, {
      drag: (dx, dir) => {
        if (reducedRef.current) {
          return;
        }
        const allowed = canGoRef.current(dir);
        if (allowed) {
          setNeighbor({ dir, key: pageKeyRef.current });
        } else if (neighborRef.current != null) {
          setNeighbor(null);
        }
        const travel = allowed
          ? dx
          : Math.max(-rubberMax, Math.min(rubberMax, dx * rubberShare));
        offset.setValue(travel);
      },
      release: (dx, dir, armed) => {
        if (!canGoRef.current(dir)) {
          back();
          return;
        }
        if (reducedRef.current) {
          if (armed) {
            onPageRef.current(dir);
          }
          return;
        }
        if (!armed) {
          back();
          return;
        }
        Animated.timing(offset, {
          toValue: dir === "left" ? -widthRef.current : widthRef.current,
          duration: 220,
          easing: easeOut,
          useNativeDriver: Platform.OS !== "web",
        }).start(({ finished }) => {
          if (finished) {
            onPageRef.current(dir);
          }
        });
      },
      cancel: back,
    }),
  );

  // The next page paints in place: the offset is gone before the frame.
  React.useLayoutEffect(() => {
    offset.stopAnimation();
    offset.setValue(0);
  }, [pageKey, width, offset]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next !== width) {
      setWidth(next);
    }
  };

  const page = (
    <View style={styles.viewport} onLayout={onLayout}>
      <Animated.View
        style={[
          styles.track,
          {
            width: width * 3,
            transform: [{ translateX: Animated.add(offset, -width) }],
          },
        ]}
      >
        <View style={[styles.cell, { width }]}>
          {side === "right" ? renderNeighbor("right") : null}
        </View>
        <View style={[styles.cell, { width }]}>{children}</View>
        <View style={[styles.cell, { width }]}>
          {side === "left" ? renderNeighbor("left") : null}
        </View>
      </Animated.View>
    </View>
  );

  return { controller, page };
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: "hidden",
  },
  track: {
    flex: 1,
    flexDirection: "row",
  },
  cell: {
    flexGrow: 0,
    flexShrink: 0,
  },
});
