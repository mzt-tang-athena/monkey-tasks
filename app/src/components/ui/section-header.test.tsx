import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
      // Done work reads the muted step, not a dimmed faint one.
      ["faint", palette.inkMuted],
    ] as const;
    for (const [tone, color] of cases) {
      const { unmount } = render(<SectionHeader label="Past" tone={tone} />);
      const style = getComputedStyle(screen.getByRole("heading"));
      expect(style.color).toBe(rgb(color));
      // A second dimming would drop the pair under 4.5 to 1.
      expect(style.opacity).toBe("1");
      unmount();
    }
  });

  it("reports an open or folded group, and presses", () => {
    const onPress = vi.fn();
    const { rerender } = render(
      <SectionHeader
        label="Completed"
        count={7}
        tone="faint"
        expanded={false}
        onPress={onPress}
      />,
    );

    const button = screen.getByRole("button", { name: "Completed 7 tasks" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(
      <SectionHeader
        label="Completed"
        count={7}
        tone="faint"
        expanded
        onPress={onPress}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: "Completed 7 tasks" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("says one task for a count of one", () => {
    render(
      <SectionHeader
        label="Completed"
        count={1}
        tone="faint"
        expanded={false}
        onPress={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Completed 1 task" })).toBeTruthy();
  });
});
