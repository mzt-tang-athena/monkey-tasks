import { Platform } from "react-native";

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

type Point = { nativeEvent: { pageX: number; pageY: number } };

/** Touch events, the native equivalent of the pointer pair. A view
    receives them while a child scroller scrolls, so the tripwire works
    over a list. */
export function touchSwipeProps(controller: SwipeController) {
  return {
    onTouchStart: (e: Point) =>
      controller.down(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onTouchMove: (e: Point) =>
      controller.move(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onTouchEnd: () => controller.up(),
    onTouchCancel: () => controller.up(),
  };
}

/**
 * The handler pair for the current platform. The browser reads pointer
 * events; React Native reads touch events. Spreading both would fire
 * the tripwire twice on web.
 */
export function swipeProps(controller: SwipeController) {
  if (Platform.OS !== "web") {
    return touchSwipeProps(controller);
  }
  return {
    onPointerDown: (e: Point) =>
      controller.down(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onPointerMove: (e: Point) =>
      controller.move(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onPointerUp: () => controller.up(),
    onPointerCancel: () => controller.up(),
  };
}
