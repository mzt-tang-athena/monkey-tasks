import { describe, expect, it } from "vitest";
import { clampFraction, clampTop } from "./split-math";

const usable = 624;
const floor = 44;

describe("clampTop", () => {
  it("keeps the top pane between the two floors", () => {
    expect(clampTop(300, usable, floor, floor)).toBe(300);
    expect(clampTop(0, usable, floor, floor)).toBe(floor);
    expect(clampTop(-40, usable, floor, floor)).toBe(floor);
    expect(clampTop(usable, usable, floor, floor)).toBe(usable - floor);
    expect(clampTop(900, usable, floor, floor)).toBe(usable - floor);
  });

  it("gives the top pane its floor when both floors do not fit", () => {
    expect(clampTop(10, 60, floor, floor)).toBe(floor);
  });

  it("keeps a negative floor at zero", () => {
    expect(clampTop(-20, usable, -10, floor)).toBe(0);
  });
});

describe("clampFraction", () => {
  it("turns the floors into shares of the usable height", () => {
    expect(clampFraction(0, usable, floor, floor)).toBeCloseTo(floor / usable, 6);
    expect(clampFraction(1, usable, floor, floor)).toBeCloseTo(
      (usable - floor) / usable,
      6,
    );
    expect(clampFraction(0.5, usable, floor, floor)).toBeCloseTo(0.5, 6);
  });

  it("re-clamps a share that a shorter screen makes invalid", () => {
    // The share the top limit gives on a 915pt screen, on a 640pt one.
    const onTall = floor / usable;
    expect(clampFraction(onTall, 349, floor, floor)).toBeCloseTo(floor / 349, 6);
  });

  it("leaves the share alone when there is no usable height", () => {
    expect(clampFraction(0.3, 0, floor, floor)).toBe(0.3);
    expect(clampFraction(0.3, -28, floor, floor)).toBe(0.3);
  });
});
