import { describe, expect, it } from "vitest";
import { tabUnderline } from "./tab-math";

const main = { x: 0, width: 68 };
const errands = { x: 76, width: 100 };
const focus = { x: 184, width: 84 };
const boxes = [main, errands, focus];

describe("tabUnderline", () => {
  it("sits inset under a tab at rest", () => {
    expect(tabUnderline(boxes, 1, 12)).toEqual({ left: 88, width: 76 });
  });

  it("sits halfway between two tabs at half a page", () => {
    expect(tabUnderline(boxes, 0.5, 12)).toEqual({
      left: 0.5 * (main.x + errands.x) + 12,
      width: 0.5 * (main.width + errands.width) - 24,
    });
  });

  it("blends the width across a quarter page", () => {
    const quarter = tabUnderline(boxes, 1.25, 12);
    expect(quarter.width).toBe(errands.width + (focus.width - errands.width) * 0.25 - 24);
    expect(quarter.left).toBe(errands.x + (focus.x - errands.x) * 0.25 + 12);
  });

  it("holds the last tab past the end", () => {
    expect(tabUnderline(boxes, 7, 12)).toEqual({ left: focus.x + 12, width: focus.width - 24 });
  });

  it("holds the first tab before the start", () => {
    expect(tabUnderline(boxes, -2, 12)).toEqual({ left: 12, width: main.width - 24 });
  });

  it("draws nothing when a box is missing", () => {
    expect(tabUnderline([main, null, focus], 0, 12)).toEqual({ left: 0, width: 0 });
    expect(tabUnderline([], 0, 12)).toEqual({ left: 0, width: 0 });
  });

  it("never returns a negative width", () => {
    expect(tabUnderline([{ x: 0, width: 10 }], 0, 12).width).toBe(0);
  });
});
