import { describe, expect, it } from "vitest";
import { canGo, follow, releaseTarget, visiblePages } from "./pager-math";

const open = {};
const tabs = { first: 0, last: 2 };
const width = 390;

describe("follow", () => {
  it("follows the finger where a page waits", () => {
    expect(follow(-60, tabs, 1)).toBe(-60);
    expect(follow(60, tabs, 1)).toBe(60);
  });

  it("follows the finger with open bounds", () => {
    expect(follow(-300, open, 0)).toBe(-300);
    expect(follow(300, open, -40)).toBe(300);
  });

  it("rubber bands at a closed end on either side", () => {
    expect(follow(50, tabs, 0)).toBeCloseTo(50 * 0.28);
    expect(follow(-50, tabs, 2)).toBeCloseTo(-50 * 0.28);
  });

  it("caps the rubber band", () => {
    expect(follow(1000, tabs, 0)).toBe(48);
    expect(follow(-1000, tabs, 2)).toBe(-48);
  });
});

describe("releaseTarget", () => {
  it("commits a drag past the threshold toward the next page", () => {
    expect(releaseTarget({ dx: -80, vx: 0, width, bounds: tabs, page: 0 })).toBe(1);
    expect(releaseTarget({ dx: 80, vx: 0, width, bounds: tabs, page: 2 })).toBe(-1);
  });

  it("returns a slow drag under the threshold", () => {
    expect(releaseTarget({ dx: -79, vx: -100, width, bounds: tabs, page: 0 })).toBe(0);
  });

  it("commits a flick under the threshold", () => {
    expect(releaseTarget({ dx: -30, vx: -500, width, bounds: tabs, page: 0 })).toBe(1);
    expect(releaseTarget({ dx: 30, vx: 650, width, bounds: tabs, page: 1 })).toBe(-1);
  });

  it("returns a drag the finger flicks back", () => {
    expect(releaseTarget({ dx: -120, vx: 700, width, bounds: tabs, page: 0 })).toBe(0);
  });

  it("commits a drag past half the width whatever the flick", () => {
    expect(releaseTarget({ dx: -200, vx: 900, width, bounds: tabs, page: 0 })).toBe(1);
  });

  it("never passes a closed end", () => {
    expect(releaseTarget({ dx: 200, vx: 900, width, bounds: tabs, page: 0 })).toBe(0);
    expect(releaseTarget({ dx: -200, vx: -900, width, bounds: tabs, page: 2 })).toBe(0);
  });

  it("goes either way with open bounds", () => {
    expect(releaseTarget({ dx: 100, vx: 0, width, bounds: open, page: -7 })).toBe(-1);
    expect(releaseTarget({ dx: -100, vx: 0, width, bounds: open, page: 7 })).toBe(1);
  });
});

describe("visiblePages", () => {
  it("shows one page at rest", () => {
    expect(visiblePages(0, width)).toEqual([0]);
    expect(visiblePages(-3, width)).toEqual([-3]);
  });

  it("shows both pages mid swipe", () => {
    expect(visiblePages(0.4, width)).toEqual([0, 1]);
    expect(visiblePages(-0.25, width)).toEqual([-1, 0]);
  });

  it("treats a sub-pixel remainder as rest", () => {
    expect(visiblePages(1 + 0.4 / width, width)).toEqual([1]);
    expect(visiblePages(2 - 0.4 / width, width)).toEqual([2]);
  });
});

describe("canGo", () => {
  it("reads the bounds", () => {
    expect(canGo(tabs, 0)).toBe(true);
    expect(canGo(tabs, 2)).toBe(true);
    expect(canGo(tabs, -1)).toBe(false);
    expect(canGo(tabs, 3)).toBe(false);
    expect(canGo(open, 1e6)).toBe(true);
    expect(canGo({ last: 4 }, -9)).toBe(true);
  });
});
