import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { touchTarget } from "@/theme/tokens";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";

/** jsdom lays out nothing, so a target's size is the floor its style
    sets: the min height and width React Native Web writes as CSS. */
function floor(element: HTMLElement) {
  const style = getComputedStyle(element);
  return {
    height: Math.max(parseFloat(style.minHeight) || 0, parseFloat(style.height) || 0),
    width: Math.max(parseFloat(style.minWidth) || 0, parseFloat(style.width) || 0),
  };
}

function renderButton(
  props: { label: string; expanded?: boolean; onPress?: () => void },
  name: "sort" | "more",
) {
  return render(
    <IconButton {...props}>
      <Icon name={name} />
    </IconButton>,
  );
}

describe("IconButton", () => {
  it("keeps a 44 by 44 target and reports its menu state", () => {
    renderButton({ label: "sort list", expanded: true, onPress: vi.fn() }, "sort");

    const button = screen.getByRole("button", { name: "sort list" });
    const size = floor(button);
    expect(size.height).toBeGreaterThanOrEqual(touchTarget);
    expect(size.width).toBeGreaterThanOrEqual(touchTarget);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
  });

  it("fires onPress", () => {
    const onPress = vi.fn();
    renderButton({ label: "list menu", onPress }, "more");

    fireEvent.click(screen.getByRole("button", { name: "list menu" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("paints no ground at rest", () => {
    renderButton({ label: "list menu", onPress: vi.fn() }, "more");

    const ground = getComputedStyle(
      screen.getByRole("button", { name: "list menu" }),
    ).backgroundColor;
    expect(["", "rgba(0, 0, 0, 0)"]).toContain(ground);
  });
});
