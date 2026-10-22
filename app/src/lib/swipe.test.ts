import { describe, expect, it, vi } from "vitest";

// The tripwire is shared by the list tabs, the day planner, and the
// month planner. It used to read pointer events only, which Android
// never delivers, so every swipe was dead on the phone.

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import { makeSwipeController, touchSwipeProps } from "./swipe";

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

describe("touchSwipeProps", () => {
  it("drives the tripwire from native touch events", () => {
    const { fired, controller } = moves();
    const props = touchSwipeProps(controller);
    const at = (pageX: number, pageY: number) => ({
      nativeEvent: { pageX, pageY },
    });
    props.onTouchStart(at(300, 400));
    props.onTouchMove(at(190, 400));
    props.onTouchEnd();
    expect(fired).toEqual(["left"]);
  });
});
