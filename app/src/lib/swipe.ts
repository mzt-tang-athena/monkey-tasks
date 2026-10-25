/* eslint-disable react-hooks/refs -- the controller's callbacks read
the refs when the gesture runs, not during render. */
import * as React from "react";
import {
  Animated,
  PanResponder,
  Platform,
  type GestureResponderEvent,
  type GestureResponderHandlers,
  type PointerEvent,
} from "react-native";
import { useReduceMotion } from "./motion";

/**
 * A horizontal swipe tripwire. It arms only when the travel is clearly
 * horizontal and long enough, so vertical scrollers and row drags
 * never trip it. A gesture that starts on a drag source stays claimed
 * for its whole length: the swipe drops it.
 */
/** The travel, in px, that counts as a page swipe. */
export const swipeThreshold = 80;

/** What the page does with the travel: follow, settle, spring back. */
export type SwipeMotion = {
  /** The travel so far, in px, once the move is clearly horizontal.
      The page follows from here, below the commit threshold, so the
      finger owns the page from the first few pixels. */
  drag?: (dx: number, dir: "left" | "right") => void;
  /** The gesture ended. `armed` says whether the travel reached the
      commit threshold, so a page can spring back or settle. */
  release?: (
    dx: number,
    dir: "left" | "right",
    armed: boolean,
  ) => void;
  /** Another gesture took the touch mid swipe: return to rest. */
  cancel?: () => void;
};

export type SwipeController = {
  /** Call on pointer or touch down. `claimed` marks a touch that
      started on a drag source, which disables the tripwire. */
  down: (x: number, y: number, claimed?: boolean) => void;
  /** Call on move. */
  move: (x: number, y: number) => void;
  /** Call on up: fires the swipe if one was armed. */
  up: () => void;
  /** Disable the current gesture: a drag picked it up after the down. */
  claim: () => void;
  /** The native handlers, built once on first use. */
  handlers?: GestureResponderHandlers;
};

export function makeSwipeController(
  onSwipe: (dir: "left" | "right") => void,
  motion: SwipeMotion = {},
): SwipeController {
  let start: { x: number; y: number } | null = null;
  let claimed = false;
  let last = 0;

  return {
    down(x, y, claimed_ = false) {
      start = { x, y };
      claimed = claimed_;
      last = 0;
    },
    move(x, y) {
      if (start == null || claimed) {
        return;
      }
      const dx = x - start.x;
      const dy = y - start.y;
      // The page follows as soon as the travel reads as horizontal,
      // well before the commit threshold. A vertical scroll with a
      // little sideways drift never moves it.
      if (!horizontal(dx, dy)) {
        return;
      }
      last = dx;
      motion.drag?.(dx, dx < 0 ? "left" : "right");
    },
    up() {
      if (start != null && last !== 0) {
        const dir = last < 0 ? "left" : "right";
        const armed = Math.abs(last) >= swipeThreshold;
        if (motion.release) {
          motion.release(last, dir, armed);
        } else if (armed) {
          onSwipe(dir);
        }
      }
      start = null;
      claimed = false;
      last = 0;
    },
    claim() {
      if (last !== 0) {
        motion.cancel?.();
      }
      claimed = true;
      last = 0;
    },
  };
}


/** How long the page takes to settle on the next one. */
const settleMs = 160;

export type SwipeSlide = {
  /** The horizontal offset, applied as a translateX. */
  offset: Animated.Value;
  /** The controller to hand to `swipeProps`. */
  controller: SwipeController;
};

/**
 * A page that follows the finger. The offset resets when `key`
 * changes, before paint, so the next page appears in place instead of
 * flashing the old one.
 */
export function useSwipeSlide(
  key: string,
  onSwipe: (dir: "left" | "right") => void,
  width: number,
): SwipeSlide {
  const reduced = useReduceMotion();
  const [offset] = React.useState(() => new Animated.Value(0));
  const swipeRef = React.useRef(onSwipe);
  const widthRef = React.useRef(width);
  const reducedRef = React.useRef(reduced);
  React.useEffect(() => {
    swipeRef.current = onSwipe;
    widthRef.current = width;
    reducedRef.current = reduced;
  }, [onSwipe, width, reduced]);

  const back = React.useCallback(() => {
    offset.stopAnimation();
    if (reducedRef.current) {
      offset.setValue(0);
      return;
    }
    Animated.spring(offset, {
      toValue: 0,
      speed: 20,
      bounciness: 0,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [offset]);

  const [controller] = React.useState(() =>
    makeSwipeController((dir) => swipeRef.current(dir), {
      drag: (dx) => {
        if (!reducedRef.current) {
          offset.setValue(dx);
        }
      },
      release: (dx, dir, armed) => {
        if (reducedRef.current) {
          offset.setValue(0);
          swipeRef.current(dir);
          return;
        }
        if (!armed) {
          back();
          return;
        }
        Animated.timing(offset, {
          toValue: dir === "left" ? -widthRef.current : widthRef.current,
          duration: settleMs,
          useNativeDriver: Platform.OS !== "web",
        }).start(({ finished }) => {
          if (finished) {
            swipeRef.current(dir);
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
  }, [key, offset]);

  return { offset, controller };
}

/** Is this movement a swipe rather than a scroll? */
function horizontal(dx: number, dy: number): boolean {
  return Math.abs(dx) >= 12 && Math.abs(dx) >= 1.6 * Math.abs(dy);
}

/**
 * The native handlers. The responder system is used instead of a
 * gesture handler because the swipe sits on the parent of a scrolling
 * list, and a gesture handler there never sees the moves on Android.
 * The capture phase is what takes the touch away from the scroller.
 */
function nativeHandlers(controller: SwipeController) {
  return PanResponder.create({
    // Every touch records where it started; a swipe is decided later.
    onStartShouldSetPanResponderCapture: (e: GestureResponderEvent) => {
      controller.down(e.nativeEvent.pageX, e.nativeEvent.pageY);
      return false;
    },
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => horizontal(g.dx, g.dy),
    onMoveShouldSetPanResponderCapture: (_e, g) => horizontal(g.dx, g.dy),
    onPanResponderMove: (e: GestureResponderEvent) =>
      controller.move(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onPanResponderRelease: () => controller.up(),
    onPanResponderTerminate: () => controller.up(),
    // Once captured, the gesture is the swipe's: the scroller does not
    // take it back mid travel.
    onPanResponderTerminationRequest: () => false,
  }).panHandlers;
}

/**
 * The handlers for the current platform. The browser reads pointer
 * events; React Native reads the responder system. Spreading both
 * would fire the tripwire twice on web.
 */
export function swipeProps(
  controller: SwipeController,
  extra?: { move?: (x: number, y: number) => void; up?: () => void },
) {
  if (Platform.OS === "web") {
    return {
      onPointerDown: (e: PointerEvent) =>
        controller.down(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPointerMove: (e: PointerEvent) => {
        // The drag claims the gesture before the swipe reads the move.
        extra?.move?.(e.nativeEvent.pageX, e.nativeEvent.pageY);
        controller.move(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPointerUp: () => {
        controller.up();
        extra?.up?.();
      },
      onPointerCancel: () => {
        controller.up();
        extra?.up?.();
      },
    };
  }
  controller.handlers ??= nativeHandlers(controller);
  return controller.handlers;
}
