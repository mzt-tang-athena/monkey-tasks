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
import { makeSwipeController, type SwipeController } from "../lib/swipe";

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
      it. It sits beside the current page, out of the layout flow, so
      the current page alone sets the height. */
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
 * current page sits in the flow and keeps its identity, its height,
 * and its scroll for the whole gesture; the neighbour is drawn beside
 * it, absolutely, so it never changes the layout. On commit the
 * neighbour stays mounted until the page key has changed, so the
 * settling frame shows the neighbour rather than an empty cell.
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
  const [neighbor, setNeighbor] = React.useState<{
    dir: PagerSide;
    key: string;
  } | null>(null);
  const [width, setWidth] = React.useState(useWindowDimensions().width);
  const pageKeyRef = React.useRef(pageKey);
  const neighborRef = React.useRef(neighbor);
  const widthRef = React.useRef(width);
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
          const mounted = neighborRef.current;
          if (mounted == null || mounted.dir !== dir) {
            setNeighbor({ dir, key: pageKeyRef.current });
          }
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
          if (!finished) {
            return;
          }
          // The neighbour stays mounted for the commit: the key change
          // and the offset reset land together, and the frame in
          // between still shows the neighbour where it settled.
          const settled = neighborRef.current;
          onPageRef.current(dir);
          // Once that frame is painted the neighbour is off screen, so
          // it stops rendering until the next gesture.
          requestAnimationFrame(() => {
            if (neighborRef.current === settled) {
              setNeighbor(null);
            }
          });
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

  const side = neighbor == null ? null : neighbor.dir;
  const page = (
    <View style={styles.viewport} onLayout={onLayout}>
      <Animated.View
        style={[
          styles.track,
          { width, transform: [{ translateX: offset }] },
        ]}
      >
        <View style={[styles.cell, { width }]}>{children}</View>
        {side != null ? (
          <View
            pointerEvents="none"
            style={[
              styles.beside,
              {
                width,
                left: side === "right" ? -width : width,
              },
            ]}
          >
            {renderNeighbor(side)}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );

  return { controller, page };
}

const styles = StyleSheet.create({
  viewport: {
    flexGrow: 1,
    flexShrink: 1,
    overflow: "hidden",
  },
  track: {
    flexDirection: "row",
  },
  cell: {
    flexGrow: 0,
    flexShrink: 0,
  },
  // Out of the layout flow: the current page alone sets the height, so
  // a taller or shorter neighbour never moves the chrome.
  beside: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
});
