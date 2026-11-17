import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EdgeFade, edgeFadeWidth, fadedEdges } from "./edge-fade";

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
});

describe("EdgeFade", () => {
  it("draws a stepped fade that takes no press", () => {
    render(<EdgeFade side="end" testID="fade" />);

    const fade = screen.getByTestId("fade");
    expect(getComputedStyle(fade).pointerEvents).toBe("none");
    const steps = [...fade.children] as HTMLElement[];
    const width = steps.reduce(
      (sum, step) => sum + parseFloat(getComputedStyle(step).width),
      0,
    );
    expect(width).toBe(edgeFadeWidth);
    // Clear toward the content, solid at the edge.
    const opacities = steps.map((step) => Number(getComputedStyle(step).opacity));
    expect(opacities).toEqual([...opacities].sort((a, b) => a - b));
  });
});
