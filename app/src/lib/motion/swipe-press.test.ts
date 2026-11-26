import { describe, expect, it } from "vitest";
import { swipeAction, swipeNudge } from "./swipe-press";

const tabs = { first: 0, last: 3 };
const rest = { vx: 0, vy: 0 };

describe("swipeAction", () => {
  it("presses when the finger stayed under the commit", () => {
    expect(swipeAction({ dx: 0, dy: 0, ...rest, at: 1, bounds: tabs })).toBe("press");
    expect(swipeAction({ dx: 6, dy: 5, ...rest, at: 1, bounds: tabs })).toBe("press");
    expect(swipeAction({ dx: -20, dy: 10, ...rest, at: 1, bounds: tabs })).toBe("press");
    expect(swipeAction({ dx: 10, dy: 20, ...rest, at: 1, bounds: tabs })).toBe("press");
  });

  it("opens the commands on a swipe down", () => {
    expect(swipeAction({ dx: 0, dy: 24, ...rest, at: 1, bounds: tabs })).toBe("commands");
    expect(swipeAction({ dx: 20, dy: 40, ...rest, at: 1, bounds: tabs })).toBe("commands");
  });

  it("opens them on a downward flick too", () => {
    expect(
      swipeAction({ dx: 0, dy: 20, vx: 0, vy: 600, at: 1, bounds: tabs }),
    ).toBe("commands");
  });

  it("steps the tab the finger's way", () => {
    expect(swipeAction({ dx: 30, dy: 4, ...rest, at: 1, bounds: tabs })).toBe("next");
    expect(swipeAction({ dx: -30, dy: 4, ...rest, at: 1, bounds: tabs })).toBe("previous");
  });

  it("takes a flick under the commit", () => {
    expect(
      swipeAction({ dx: 24, dy: 0, vx: 600, vy: 0, at: 1, bounds: tabs }),
    ).toBe("next");
    expect(
      swipeAction({ dx: -24, dy: 0, vx: -600, vy: 0, at: 1, bounds: tabs }),
    ).toBe("previous");
  });

  it("reads the longer travel on a diagonal", () => {
    expect(swipeAction({ dx: 60, dy: 20, ...rest, at: 1, bounds: tabs })).toBe("next");
    expect(swipeAction({ dx: 20, dy: 60, ...rest, at: 1, bounds: tabs })).toBe("commands");
  });

  it("stops at either end without a press", () => {
    expect(swipeAction({ dx: -120, dy: 0, ...rest, at: 0, bounds: tabs })).toBe("none");
    expect(swipeAction({ dx: 120, dy: 0, ...rest, at: 3, bounds: tabs })).toBe("none");
    expect(
      swipeAction({ dx: 120, dy: 0, vx: 600, vy: 0, at: 3, bounds: tabs }),
    ).toBe("none");
  });

  it("still moves away from an end", () => {
    expect(swipeAction({ dx: 120, dy: 0, ...rest, at: 0, bounds: tabs })).toBe("next");
    expect(swipeAction({ dx: -120, dy: 0, ...rest, at: 3, bounds: tabs })).toBe(
      "previous",
    );
  });

  it("does nothing on a committed swipe up", () => {
    expect(swipeAction({ dx: 0, dy: -120, ...rest, at: 1, bounds: tabs })).toBe("none");
  });
});

describe("swipeNudge", () => {
  it("rests with no finger travel", () => {
    expect(swipeNudge({ dx: 0, dy: 0, at: 1, bounds: tabs })).toEqual({ x: 0, y: 0 });
  });

  it("follows a sideways travel a share of the way", () => {
    const nudge = swipeNudge({ dx: -40, dy: 0, at: 1, bounds: tabs });
    expect(nudge.x).toBeCloseTo(-40 * 0.28);
    expect(nudge.y).toBe(0);
  });

  it("follows a downward travel and holds on an upward one", () => {
    expect(swipeNudge({ dx: 0, dy: 30, at: 1, bounds: tabs }).y).toBeCloseTo(30 * 0.28);
    expect(swipeNudge({ dx: 0, dy: -30, at: 1, bounds: tabs }).y).toBe(0);
  });

  it("caps at 12 points", () => {
    expect(swipeNudge({ dx: -300, dy: 300, at: 1, bounds: tabs })).toEqual({
      x: -12,
      y: 12,
    });
  });

  it("scarcely moves toward a closed end", () => {
    const free = swipeNudge({ dx: 40, dy: 0, at: 1, bounds: tabs });
    expect(Math.abs(swipeNudge({ dx: 40, dy: 0, at: 3, bounds: tabs }).x)).toBeLessThan(
      Math.abs(free.x),
    );
    expect(Math.abs(swipeNudge({ dx: -40, dy: 0, at: 0, bounds: tabs }).x)).toBeLessThan(
      Math.abs(free.x),
    );
  });
});
