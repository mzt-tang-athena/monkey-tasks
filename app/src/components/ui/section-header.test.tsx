import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/theme/tokens";
import { SectionHeader } from "./section-header";

/** jsdom reports colors as rgb(); the palette holds hex. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

describe("SectionHeader", () => {
  it("reads as a header with its label and count", () => {
    render(<SectionHeader label="Today" count={3} />);

    // The two spaces match what the Lists screen draws, which the
    // Playwright locator for a section header reads.
    expect(screen.getByRole("heading").textContent).toBe("Today  3");
  });

  it("leaves the count out when it has none", () => {
    render(<SectionHeader label="Timeline" />);

    expect(screen.getByRole("heading").textContent).toBe("Timeline");
  });

  it("colors its label by tone", () => {
    const palette = THEMES.budget;
    const cases = [
      ["accent", palette.accent],
      ["danger", palette.danger],
      ["muted", palette.inkMuted],
      ["faint", palette.inkFaint],
    ] as const;
    for (const [tone, color] of cases) {
      const { unmount } = render(<SectionHeader label="Past" tone={tone} />);
      expect(getComputedStyle(screen.getByRole("heading")).color).toBe(rgb(color));
      unmount();
    }
  });
});
