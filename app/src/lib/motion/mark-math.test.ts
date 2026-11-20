import { describe, expect, it } from "vitest";
import { markBetween } from "./mark-math";

const main = { x: 0, width: 68 };
const errands = { x: 76, width: 100 };
const focus = { x: 184, width: 84 };
const places = [main, errands, focus];

describe("markBetween", () => {
  it("sits inset under a cell at rest", () => {
    expect(markBetween(places, 1, 12)).toEqual({ left: 88, width: 76 });
  });

  it("sits halfway between two cells at half a page", () => {
    expect(markBetween(places, 0.5, 12)).toEqual({
      left: 0.5 * (main.x + errands.x) + 12,
      width: 0.5 * (main.width + errands.width) - 24,
    });
  });

  it("blends the width across a quarter page", () => {
    const quarter = markBetween(places, 1.25, 12);
    expect(quarter.width).toBe(errands.width + (focus.width - errands.width) * 0.25 - 24);
    expect(quarter.left).toBe(errands.x + (focus.x - errands.x) * 0.25 + 12);
  });

  it("holds the last cell past the end", () => {
    expect(markBetween(places, 7, 12)).toEqual({ left: focus.x + 12, width: focus.width - 24 });
  });

  it("holds the first cell before the start", () => {
    expect(markBetween(places, -2, 12)).toEqual({ left: 12, width: main.width - 24 });
  });

  it("draws nothing when a cell is missing", () => {
    expect(markBetween([main, null, focus], 0, 12)).toEqual({ left: 0, width: 0 });
    expect(markBetween([], 0, 12)).toEqual({ left: 0, width: 0 });
  });

  it("never returns a negative width", () => {
    expect(markBetween([{ x: 0, width: 10 }], 0, 12).width).toBe(0);
  });
});
