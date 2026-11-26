import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EdgeFade, fadedEdges, fadeReach } from "./edge-fade";

describe("fadedEdges", () => {
  it("fades nothing when the content fits", () => {
    expect(fadedEdges({ view: 312, content: 300, x: 0 })).toEqual({
      start: false,
      end: false,
    });
  });

  it("fades the end while more content waits past it", () => {
    expect(fadedEdges({ view: 312, content: 340, x: 0 })).toEqual({
      start: false,
      end: true,
    });
  });

  it("fades the start once scrolled, and drops the end at the far edge", () => {
    expect(fadedEdges({ view: 312, content: 340, x: 28 })).toEqual({
      start: true,
      end: false,
    });
  });

  it("fades nothing before the view is measured", () => {
    expect(fadedEdges({ view: 0, content: 150, x: 0 })).toEqual({
      start: false,
      end: false,
    });
  });
});

describe("fadeReach", () => {
  const space = { inset: 12, gap: 4 };
  const boxes = [
    { x: 0, width: 100 },
    { x: 104, width: 80 },
    { x: 188, width: 120 },
    { x: 312, width: 90 },
  ];

  it("ends the start fade on the gap before the first whole name", () => {
    const frame = { view: 200, x: 60 };
    const reach = fadeReach("start", frame, boxes, space);
    // The second name starts 56 px in, at 104 + 12 - 60.
    const span = reach.cover + reach.steps * 4;
    expect(span).toBe(104 + 12 - 60 - 4);
    // The first name ends at 88 - 60 = 28 px in, under the cover.
    expect(reach.cover).toBeGreaterThanOrEqual(100 - 12 - 60);
  });

  it("ends the end fade on the gap after the last whole name", () => {
    const frame = { view: 330, x: 0 };
    const reach = fadeReach("end", frame, boxes, space);
    // The third name ends at 188 + 120 - 12 = 296, so the fade starts at 300.
    expect(reach.cover + reach.steps * 4).toBe(330 - 296 - 4);
  });

  it("keeps the ramp inside the gap between two names", () => {
    const reach = fadeReach("start", { view: 200, x: 60 }, boxes, space);
    expect(reach.steps * 4).toBeLessThanOrEqual(2 * 12 + 4 - 4);
  });

  it("draws a plain ramp until every item is measured", () => {
    const reach = fadeReach("start", { view: 200, x: 60 }, [boxes[0], null], space);
    expect(reach).toEqual({ cover: 0, steps: 5 });
  });
});

describe("EdgeFade", () => {
  it("draws a stepped fade that takes no press", () => {
    render(<EdgeFade side="end" reach={{ cover: 8, steps: 3 }} testID="fade" />);

    const fade = screen.getByTestId("fade");
    expect(getComputedStyle(fade).pointerEvents).toBe("none");
    const steps = [...fade.children] as HTMLElement[];
    const width = steps.reduce(
      (sum, step) => sum + parseFloat(getComputedStyle(step).width),
      0,
    );
    expect(width).toBe(8 + 3 * 4);
    // Clear toward the content, solid at the edge.
    const opacities = steps.map((step) => Number(getComputedStyle(step).opacity));
    expect(opacities).toEqual([...opacities].sort((a, b) => a - b));
    expect(opacities.at(-1)).toBe(1);
  });

  it("puts the cover at the start edge, then the ramp", () => {
    render(<EdgeFade side="start" reach={{ cover: 8, steps: 2 }} testID="fade" />);

    const steps = [...screen.getByTestId("fade").children] as HTMLElement[];
    const widths = steps.map((step) => parseFloat(getComputedStyle(step).width));
    expect(widths).toEqual([8, 4, 4]);
  });
});
