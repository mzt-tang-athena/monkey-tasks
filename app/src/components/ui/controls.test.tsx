import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { touchTarget } from "@/theme/tokens";
import { Button } from "./button";
import { SegmentedControl } from "./segmented-control";
import { TabStrip } from "./tab-strip";

/** jsdom lays out nothing, so a target's size is the floor its style
    sets: the min height and width React Native Web writes as CSS. */
function floor(element: HTMLElement) {
  const style = getComputedStyle(element);
  return {
    height: Math.max(parseFloat(style.minHeight) || 0, parseFloat(style.height) || 0),
    width: Math.max(parseFloat(style.minWidth) || 0, parseFloat(style.width) || 0),
  };
}

describe("TabStrip", () => {
  const tabs = ["Main", "Errands", "Focus"];

  it("reports a tab list of tabs, with the selected one marked", () => {
    render(<TabStrip label="Lists" tabs={tabs} selected="Errands" onSelect={vi.fn()} />);

    expect(screen.getByRole("tablist", { name: "Lists" })).toBeTruthy();
    expect(
      screen.getAllByRole("tab").map((tab) => [tab.textContent, tab.getAttribute("aria-selected")]),
    ).toEqual([
      ["Main", "false"],
      ["Errands", "true"],
      ["Focus", "false"],
    ]);
  });

  it("selects a tab on a press", () => {
    const onSelect = vi.fn();
    render(<TabStrip label="Lists" tabs={tabs} selected="Main" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("tab", { name: "Focus" }));

    expect(onSelect).toHaveBeenCalledWith("Focus");
  });

  it("gives every tab a target of at least 44 by 44", () => {
    render(<TabStrip label="Lists" tabs={["A", ...tabs]} selected="A" onSelect={vi.fn()} />);

    for (const tab of screen.getAllByRole("tab")) {
      const size = floor(tab);
      expect(size.height).toBeGreaterThanOrEqual(touchTarget);
      expect(size.width).toBeGreaterThanOrEqual(touchTarget);
    }
  });

  it("scrolls the selected tab into view", () => {
    const { rerender } = render(
      <TabStrip label="Lists" tabs={tabs} selected="Main" onSelect={vi.fn()} />,
    );
    const strip = screen.getByRole("tablist");
    const scroll = vi.fn();
    // React Native Web scrolls the strip's own element.
    for (const node of [strip, ...strip.querySelectorAll("div")]) {
      (node as HTMLElement).scroll = scroll;
    }
    // The layout pass that jsdom skips: Focus starts 200 px in.
    fireLayout(screen.getByRole("tab", { name: "Focus" }), 200);

    rerender(<TabStrip label="Lists" tabs={tabs} selected="Focus" onSelect={vi.fn()} />);

    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ left: 188 }));
  });
});

/** Hand an element the layout React Native Web would report. Its
    layout comes through a ResizeObserver, which jsdom lacks, so the
    test calls the handler React Native Web hangs on the element. */
function fireLayout(element: HTMLElement, x: number) {
  const handler = (element as unknown as {
    __reactLayoutHandler?: (event: unknown) => void;
  }).__reactLayoutHandler;
  act(() => {
    handler?.({ nativeEvent: { layout: { x, y: 0, width: 80, height: 44 } } });
  });
}

describe("SegmentedControl", () => {
  const segments = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
  ] as const;

  it("reports its segments as tabs, with the selected one marked", () => {
    render(
      <SegmentedControl
        label="Planner mode"
        segments={[...segments]}
        selected="week"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("tablist", { name: "Planner mode" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Week" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Day" }).getAttribute("aria-selected")).toBe("false");
  });

  it("selects a segment on a press", () => {
    const onSelect = vi.fn();
    render(
      <SegmentedControl
        label="Planner mode"
        segments={[...segments]}
        selected="day"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Month" }));

    expect(onSelect).toHaveBeenCalledWith("month");
  });

  it("names an icon segment and gives every segment a 44 by 44 target", () => {
    render(
      <SegmentedControl
        label="Task form"
        segments={[
          { key: "rows", icon: "rows", accessibilityLabel: "list form" },
          { key: "pills", icon: "pill", accessibilityLabel: "pill form" },
        ]}
        selected="rows"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "pill form" })).toBeTruthy();
    for (const tab of screen.getAllByRole("tab")) {
      const size = floor(tab);
      expect(size.height).toBeGreaterThanOrEqual(touchTarget);
      expect(size.width).toBeGreaterThanOrEqual(touchTarget);
    }
  });

  it("squares the selected segment's inner corners only", () => {
    const { rerender } = render(
      <SegmentedControl label="m" segments={[...segments]} selected="day" onSelect={vi.fn()} />,
    );
    const radius = (name: string) => {
      const style = getComputedStyle(screen.getByRole("tab", { name }));
      return [style.borderTopLeftRadius, style.borderTopRightRadius].map((v) => parseFloat(v));
    };
    expect(radius("Day")[0]).toBeGreaterThan(0);
    expect(radius("Day")[1]).toBe(0);

    rerender(
      <SegmentedControl label="m" segments={[...segments]} selected="week" onSelect={vi.fn()} />,
    );
    expect(radius("Week")).toEqual([0, 0]);

    rerender(
      <SegmentedControl label="m" segments={[...segments]} selected="month" onSelect={vi.fn()} />,
    );
    expect(radius("Month")[0]).toBe(0);
    expect(radius("Month")[1]).toBeGreaterThan(0);
  });
});

describe("Button text variant", () => {
  it("is a named button at least 44 high", () => {
    const onPress = vi.fn();
    render(<Button variant="text" label="Dismiss" onPress={onPress} />);

    const button = screen.getByRole("button", { name: "Dismiss" });
    fireEvent.click(button);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(floor(button).height).toBeGreaterThanOrEqual(touchTarget);
  });

  it("ignores a press while disabled", () => {
    const onPress = vi.fn();
    render(<Button variant="text" label="Retry" disabled onPress={onPress} />);

    const button = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });
});
