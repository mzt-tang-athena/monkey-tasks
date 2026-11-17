import { describe, expect, it } from "vitest";
import { sheetFollow, sheetRelease, sheetStep } from "./sheet-drag";

describe("sheetRelease", () => {
  it("dismisses a drag past the threshold", () => {
    expect(sheetRelease({ dy: 80, vy: 0 })).toBe("dismiss");
    expect(sheetRelease({ dy: 300, vy: 100 })).toBe("dismiss");
  });

  it("returns a slow drag under the threshold", () => {
    expect(sheetRelease({ dy: 79, vy: 499 })).toBe("return");
  });

  it("dismisses a downward flick under the threshold", () => {
    expect(sheetRelease({ dy: 20, vy: 500 })).toBe("dismiss");
  });

  it("returns a drag the finger flicks back up", () => {
    expect(sheetRelease({ dy: 200, vy: -500 })).toBe("return");
  });

  it("returns an upward drag, however fast", () => {
    expect(sheetRelease({ dy: -40, vy: 2000 })).toBe("return");
    expect(sheetRelease({ dy: 0, vy: 2000 })).toBe("return");
  });
});

describe("sheetFollow", () => {
  it("follows the finger down", () => {
    expect(sheetFollow(0)).toBe(0);
    expect(sheetFollow(120)).toBe(120);
  });

  it("stretches upward, up to a cap", () => {
    expect(sheetFollow(-50)).toBeCloseTo(-50 * 0.28);
    expect(sheetFollow(-1000)).toBe(-48);
  });
});

describe("sheetStep", () => {
  it("drags, then dismisses or settles back", () => {
    expect(sheetStep("idle", "grab")).toBe("dragging");
    expect(sheetStep("dragging", "dismiss")).toBe("dismissing");
    expect(sheetStep("dragging", "return")).toBe("settling");
    expect(sheetStep("settling", "settled")).toBe("idle");
  });

  it("catches a settling panel", () => {
    expect(sheetStep("settling", "grab")).toBe("dragging");
  });

  it("holds a dismissed panel until the sheet opens again", () => {
    expect(sheetStep("dismissing", "grab")).toBeNull();
    expect(sheetStep("dismissing", "settled")).toBeNull();
    expect(sheetStep("dismissing", "reopen")).toBe("idle");
  });

  it("ignores a release with no drag", () => {
    expect(sheetStep("idle", "dismiss")).toBeNull();
    expect(sheetStep("settling", "return")).toBeNull();
  });
});
