import * as React from "react";
import { Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEMES } from "@/theme/palettes";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { Pressable } from "./pressable";

/**
 * The focus mark follows the browser's `:focus-visible` verdict. jsdom
 * has no input modality, so it reports the selector true for every
 * focus. The pointer test hands the predicate the answer a browser
 * gives a mouse, and a real browser proves the rest in
 * `e2e/specs/focus-ring.spec.ts`.
 */

const budget = THEMES.budget;

/** The browser's color format, so the palette hex compares to it. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

function mark(element: HTMLElement) {
  const style = getComputedStyle(element);
  return {
    style: style.outlineStyle,
    width: style.outlineWidth,
    color: style.outlineColor,
    offset: style.outlineOffset,
    shadow: style.boxShadow,
  };
}

function renderTarget() {
  render(
    <Pressable accessibilityRole="button" accessibilityLabel="sort list">
      <Text>sort</Text>
    </Pressable>,
  );
  return screen.getByRole("button", { name: "sort list" });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the focus mark", () => {
  it("draws at the target's edge on keyboard focus", () => {
    const target = renderTarget();

    act(() => target.focus());

    // The default provider palette is budget's.
    expect(mark(target)).toEqual({
      style: "solid",
      width: "2px",
      color: rgb(budget.focusRing),
      offset: "-2px",
      // jsdom lowercases a box-shadow color.
      shadow: `inset 0 0 0 4px ${budget.onAccent.toLowerCase()}`,
    });
  });

  it("stays off when the browser reports a pointer focus", () => {
    const verdict = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ":focus-visible" ? false : verdict.call(this, selector);
    });
    const target = renderTarget();

    fireEvent.pointerDown(target);
    act(() => target.focus());

    expect(mark(target).style).toBe("none");
  });

  it("drops on a press that follows a keyboard focus", () => {
    const target = renderTarget();
    act(() => target.focus());
    expect(mark(target).style).toBe("solid");

    fireEvent.pointerDown(target);

    expect(mark(target).style).toBe("none");
  });

  it("reaches Button and IconButton through the shared press", () => {
    render(
      <React.Fragment>
        <Button label="Save task" />
        <IconButton label="sort tasks">
          <Text>s</Text>
        </IconButton>
      </React.Fragment>,
    );

    for (const target of [
      screen.getByRole("button", { name: "Save task" }),
      screen.getByRole("button", { name: "sort tasks" }),
    ]) {
      act(() => target.focus());
      expect(mark(target).style, target.getAttribute("aria-label") ?? "").toBe(
        "solid",
      );
      act(() => target.blur());
      expect(mark(target).style).toBe("none");
    }
  });

  it("never marks a disabled target", () => {
    render(<Button label="Save task" disabled />);
    const target = screen.getByRole("button", { name: "Save task" });

    act(() => target.focus());

    expect(mark(target).style).toBe("none");
  });
});
