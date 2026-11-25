import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { touchTarget } from "@/theme/tokens";
import { THEMES } from "@/theme/palettes";
import { Switch } from "./switch";

/** jsdom lays out nothing, so a target's size is the floor its style
    sets: the min height and width React Native Web writes as CSS. */
function floor(element: HTMLElement) {
  const style = getComputedStyle(element);
  return {
    height: Math.max(parseFloat(style.minHeight) || 0, parseFloat(style.height) || 0),
    width: Math.max(parseFloat(style.minWidth) || 0, parseFloat(style.width) || 0),
  };
}

/** jsdom reports colors as rgb(); the palettes hold hex. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

describe("Switch", () => {
  it("keeps a 44pt target and reports its state", () => {
    render(
      <Switch checked label="Board" onCheckedChange={vi.fn()} testID="board" />,
    );

    const control = screen.getByRole("switch", { name: "Board" });
    const size = floor(control);
    expect(size.height).toBeGreaterThanOrEqual(touchTarget);
    expect(size.width).toBeGreaterThanOrEqual(touchTarget);
    expect(control.getAttribute("aria-checked")).toBe("true");
  });

  it("asks for the opposite state", () => {
    const change = vi.fn();
    render(<Switch checked={false} label="Board" onCheckedChange={change} />);

    fireEvent.click(screen.getByRole("switch", { name: "Board" }));

    expect(change).toHaveBeenCalledWith(true);
  });

  it("paints the track in the palette", () => {
    render(
      <>
        <Switch
          checked
          label="on"
          onCheckedChange={vi.fn()}
          trackTestID="on-track"
        />
        <Switch
          checked={false}
          label="off"
          onCheckedChange={vi.fn()}
          trackTestID="off-track"
        />
      </>,
    );

    expect(getComputedStyle(screen.getByTestId("on-track")).backgroundColor).toBe(
      rgb(THEMES.budget.accent),
    );
    expect(getComputedStyle(screen.getByTestId("off-track")).backgroundColor).toBe(
      rgb(THEMES.budget.pressed),
    );
  });
});
