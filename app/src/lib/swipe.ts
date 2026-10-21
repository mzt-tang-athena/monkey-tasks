import type * as React from "react";

/**
 * A horizontal swipe tripwire for pointer events. It arms only when
 * the pointer's travel is clearly horizontal and long enough, so
 * vertical scrollers and row drags never trip it. A gesture that
 * starts on a drag source (a task row, the resize grabber) stays
 * claimed forever: the swipe drops it.
 */
export type SwipeController = {
  /** Call on pointer down. `claimed` marks a touch that started on a
      drag source, which disables the tripwire for the whole gesture. */
  down: (x: number, y: number, claimed?: boolean) => void;
  /** Call on pointer move. */
  move: (x: number, y: number) => void;
  /** Call on pointer up: fires the swipe if one was armed. */
  up: () => void;
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
  };
}

/** The three pointer handlers, spread onto a View. Wiring order
    note: create the controller once with `useState`, so the handler
    object stays stable across renders. */
export function swipeProps(controller: SwipeController) {
  return {
    onPointerDown: (e: { nativeEvent: { pageX: number; pageY: number } }) =>
      controller.down(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onPointerMove: (e: { nativeEvent: { pageX: number; pageY: number } }) =>
      controller.move(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onPointerUp: () => controller.up(),
  };
}
