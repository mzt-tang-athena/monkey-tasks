import { describe, expect, it, vi } from "vitest";

// The tripwire is shared by the list tabs, the day planner, and the
// month planner. It used to read pointer events only, which Android
// never delivers, so every swipe was dead on the phone.

vi.mock("react-native", () => ({
  Easing: { bezier: () => (value: number) => value },
  Platform: { OS: "android" },
  PanResponder: {
    create: (config: unknown) => ({ panHandlers: { config } }),
  },
}));

import {
  makeSwipeController,
  swipeProps,
  swipeThreshold,
  type SwipeMotion,
} from "./swipe";

function moves() {
  const fired: ("left" | "right")[] = [];
  const controller = makeSwipeController((dir) => fired.push(dir));
  return { fired, controller };
}

describe("makeSwipeController", () => {
  it("fires left on a long horizontal travel to the left", () => {
    const { fired, controller } = moves();
    controller.down(300, 400);
    controller.move(200, 405);
    controller.up();
    expect(fired).toEqual(["left"]);
  });

  it("fires right on a long horizontal travel to the right", () => {
    const { fired, controller } = moves();
    controller.down(100, 400);
    controller.move(220, 402);
    controller.up();
    expect(fired).toEqual(["right"]);
  });

  it("ignores a short move", () => {
    const { fired, controller } = moves();
    controller.down(300, 400);
    controller.move(250, 400);
    controller.up();
    expect(fired).toEqual([]);
  });

  it("ignores a diagonal move that is mostly vertical", () => {
    const { fired, controller } = moves();
    controller.down(300, 400);
    controller.move(190, 500);
    controller.up();
    expect(fired).toEqual([]);
  });

  it("drops a gesture a drag claimed after the down", () => {
    const { fired, controller } = moves();
    controller.down(300, 400);
    controller.claim();
    controller.move(150, 400);
    controller.up();
    expect(fired).toEqual([]);
  });

  it("starts clean after a claimed gesture ends", () => {
    const { fired, controller } = moves();
    controller.down(300, 400);
    controller.claim();
    controller.move(150, 400);
    controller.up();
    controller.down(300, 400);
    controller.move(150, 400);
    controller.up();
    expect(fired).toEqual(["left"]);
  });
});

describe("makeSwipeController with motion", () => {
  function follow() {
    const dragged: [number, "left" | "right"][] = [];
    const released: [number, "left" | "right", boolean][] = [];
    let cancelled = 0;
    const fired: ("left" | "right")[] = [];
    const motion: SwipeMotion = {
      drag: (dx, dir) => dragged.push([dx, dir]),
      release: (dx, dir, armed) => released.push([dx, dir, armed]),
      cancel: () => {
        cancelled += 1;
      },
    };
    const controller = makeSwipeController((dir) => fired.push(dir), motion);
    return {
      cancelled: () => cancelled,
      controller,
      dragged,
      fired,
      released,
    };
  }

  it("follows the finger from the first horizontal travel", () => {
    const page = follow();
    page.controller.down(300, 400);
    page.controller.move(290, 400);
    expect(page.dragged).toEqual([]);
    page.controller.move(288, 400);
    expect(page.dragged).toEqual([[-12, "left"]]);
    page.controller.move(150, 402);
    expect(page.dragged).toEqual([
      [-12, "left"],
      [-150, "left"],
    ]);
  });

  it("never follows a scroll", () => {
    const page = follow();
    page.controller.down(300, 400);
    page.controller.move(295, 460);
    page.controller.move(290, 520);
    page.controller.move(240, 600);
    expect(page.dragged).toEqual([]);
  });

  it("follows a sideways drift that is still mostly vertical only once it reads horizontal", () => {
    const page = follow();
    page.controller.down(300, 400);
    page.controller.move(280, 440);
    expect(page.dragged).toEqual([]);
  });

  it("reports the travel, the direction and whether it can commit", () => {
    const page = follow();
    page.controller.down(300, 400);
    page.controller.move(150, 400);
    page.controller.up();
    expect(page.released).toEqual([[-150, "left", true]]);
    expect(page.fired).toEqual([]);
  });

  it("reports the travel at the release, not the peak", () => {
    const page = follow();
    page.controller.down(300, 400);
    page.controller.move(150, 400);
    page.controller.move(280, 400);
    page.controller.up();
    expect(page.released).toEqual([[-20, "left", false]]);
  });

  it("says a short travel cannot commit", () => {
    const page = follow();
    page.controller.down(300, 400);
    page.controller.move(300 - swipeThreshold + 1, 400);
    page.controller.up();
    expect(page.released).toEqual([
      [-(swipeThreshold - 1), "left", false],
    ]);
  });

  it("says a travel at the threshold can commit", () => {
    const page = follow();
    page.controller.down(300, 400);
    page.controller.move(300 - swipeThreshold, 400);
    page.controller.up();
    expect(page.released).toEqual([[-swipeThreshold, "left", true]]);
  });

  it("returns a claimed page to rest", () => {
    const page = follow();
    page.controller.down(300, 400);
    page.controller.move(150, 400);
    page.controller.claim();
    expect(page.cancelled()).toBe(1);
    expect(page.released).toEqual([]);
  });

  it("does not report a cancel before the page started to follow", () => {
    const page = follow();
    page.controller.down(300, 400);
    page.controller.move(295, 400);
    page.controller.claim();
    expect(page.cancelled()).toBe(0);
  });

  it("starts clean after a release", () => {
    const page = follow();
    page.controller.down(300, 400);
    page.controller.move(150, 400);
    page.controller.up();
    page.controller.down(300, 400);
    page.controller.move(150, 400);
    page.controller.up();
    expect(page.released).toEqual([
      [-150, "left", true],
      [-150, "left", true],
    ]);
  });
});

describe("swipeProps", () => {
  type Config = {
    onStartShouldSetPanResponderCapture: (e: unknown) => boolean;
    onMoveShouldSetPanResponderCapture: (
      e: unknown,
      g: { dx: number; dy: number },
    ) => boolean;
    onPanResponderMove: (e: unknown) => void;
    onPanResponderRelease: () => void;
  };
  const at = (pageX: number, pageY: number) => ({
    nativeEvent: { pageX, pageY },
  });
  const config = (controller: ReturnType<typeof makeSwipeController>) =>
    (swipeProps(controller) as unknown as { config: Config }).config;

  it("takes the gesture only for a horizontal move", () => {
    const { controller } = moves();
    const pan = config(controller);
    expect(pan.onMoveShouldSetPanResponderCapture(at(0, 0), { dx: 30, dy: 4 })).toBe(true);
    expect(pan.onMoveShouldSetPanResponderCapture(at(0, 0), { dx: 6, dy: 2 })).toBe(false);
    expect(pan.onMoveShouldSetPanResponderCapture(at(0, 0), { dx: 30, dy: 60 })).toBe(false);
  });

  it("drives the tripwire from the responder events", () => {
    const { fired, controller } = moves();
    const pan = config(controller);
    pan.onStartShouldSetPanResponderCapture(at(300, 400));
    pan.onPanResponderMove(at(190, 400));
    pan.onPanResponderRelease();
    expect(fired).toEqual(["left"]);
  });

  it("builds the handlers once per controller", () => {
    const { controller } = moves();
    expect(swipeProps(controller)).toBe(swipeProps(controller));
  });
});
