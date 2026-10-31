import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";

const names: IconName[] = [
  "list",
  "calendar",
  "calendar-mini",
  "clock-mini",
  "plus",
  "sort",
  "more",
  "rows",
  "pill",
  "repeat",
  "grip",
  "grip-bars",
  "chevron-down",
];

function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Every color a glyph paints: fills, drawn edges and text. */
function paints(root: HTMLElement): Set<string> {
  const found = new Set<string>();
  for (const node of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    const style = getComputedStyle(node);
    const painted = [style.backgroundColor];
    for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
      if (parseFloat(style[`border${side}Width`]) > 0) {
        painted.push(style[`border${side}Color`]);
      }
    }
    if (node.children.length === 0 && (node.textContent ?? "") !== "") {
      painted.push(style.color);
    }
    for (const value of painted) {
      if (value.startsWith("rgb(")) {
        found.add(value);
      }
    }
  }
  return found;
}

describe("Icon", () => {
  it.each(names)("draws %s from views, hidden from assistive tech", (name) => {
    render(<Icon name={name} />);

    const icon = screen.getByTestId(`icon:${name}`);
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.children.length).toBeGreaterThan(0);
  });

  it.each(names)("paints %s in the color it is given", (name) => {
    render(<Icon name={name} color="danger" />);

    const colors = paints(screen.getByTestId(`icon:${name}`));
    expect(colors).toContain(rgb(THEMES.budget.danger));
    // No black default edge: every painted color is the token.
    expect([...colors].filter((color) => color !== rgb(THEMES.budget.danger))).toEqual([]);
  });
});
