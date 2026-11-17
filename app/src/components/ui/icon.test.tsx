import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/theme/tokens";
import { GLYPHS, type GlyphName } from "./glyphs";
import { Icon } from "./icon";

const names = Object.keys(GLYPHS) as GlyphName[];

/** The colour each path of an icon paints. */
function paints(root: HTMLElement): string[] {
  return [...root.querySelectorAll("path")].map(
    (path) => path.getAttribute("fill") ?? "",
  );
}

describe("Icon", () => {
  it.each(names)("draws %s as a Phosphor glyph, hidden from assistive tech", (name) => {
    render(<Icon name={name} />);

    const icon = screen.getByTestId(`icon:${name}`);
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    const svg = icon.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 256 256");
    expect(svg?.getAttribute("width")).toBe(String(GLYPHS[name].size));
    expect(paints(icon)).not.toContain("");
  });

  it.each(names)("draws %s in both weights at one box", (name) => {
    render(
      <React.Fragment>
        <Icon name={name} />
        <Icon name={name} weight="fill" />
      </React.Fragment>,
    );

    const outline = screen.getByTestId(`icon:${name}`).querySelector("svg");
    const filled = screen.getByTestId(`icon:${name}:fill`).querySelector("svg");
    // The selected state moves no pixel: both drawings fill the same box.
    expect(filled?.getAttribute("width")).toBe(outline?.getAttribute("width"));
    expect(filled?.getAttribute("height")).toBe(outline?.getAttribute("height"));
  });

  it.each(names)("paints %s in the colour it is given", (name) => {
    render(<Icon name={name} color="danger" />);

    expect(paints(screen.getByTestId(`icon:${name}`))).toEqual([
      THEMES.budget.danger,
    ]);
  });

  it("fills a sized box, centered, so it sits on a line of text", () => {
    render(<Icon name="bell" size={16} />);

    const icon = screen.getByTestId("icon:bell");
    const box = getComputedStyle(icon);
    expect(box.width).toBe("16px");
    expect(box.height).toBe("16px");
    expect(box.alignItems).toBe("center");
    expect(box.justifyContent).toBe("center");
    const svg = icon.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
  });
});
