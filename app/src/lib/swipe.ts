import {
  PanResponder,
  Platform,
  type GestureResponderEvent,
  type GestureResponderHandlers,
  type PointerEvent,
} from "react-native";

/**
 * A horizontal swipe tripwire. It arms only when the travel is clearly
 * horizontal and long enough, so vertical scrollers and row drags
 * never trip it. A gesture that starts on a drag source stays claimed
 * for its whole length: the swipe drops it.
 */
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

export function makeSwipeController(onSwipe: (dir: "left" | "right") => void): SwipeController {
  const threshold = 80;
  const straight = 1.6;
  let start: { x: number; y: number } | null = null;
  let claimed = false;
  let armed: "left" | "right" | null = null;

  return {
    down(x, y, claimed_ = false) {
      start = { x, y };
      claimed = claimed_;
      armed = null;
    },
    move(x, y) {
      if (start == null || claimed) {
        return;
      }
      const dx = x - start.x;
      const dy = y - start.y;
      if (Math.abs(dx) >= threshold && Math.abs(dx) >= straight * Math.abs(dy)) {
        armed = dx < 0 ? "left" : "right";
      }
    },
    up() {
      if (armed != null) {
        onSwipe(armed);
      }
      start = null;
      claimed = false;
      armed = null;
    },
    claim() {
      claimed = true;
      armed = null;
    },
  };
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
        controller.move(e.nativeEvent.pageX, e.nativeEvent.pageY);
        extra?.move?.(e.nativeEvent.pageX, e.nativeEvent.pageY);
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
