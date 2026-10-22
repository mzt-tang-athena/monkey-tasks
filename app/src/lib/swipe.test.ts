import { describe, expect, it, vi } from "vitest";

// The tripwire is shared by the list tabs, the day planner, and the
// month planner. It used to read pointer events only, which Android
// never delivers, so every swipe was dead on the phone.

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  PanResponder: {
    create: (config: unknown) => ({ panHandlers: { config } }),
  },
}));

import { makeSwipeController, swipeProps } from "./swipe";

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
