import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { describe, expect, it, vi } from "vitest";

// The press target is the seam: react-native-web drops the custom
// actions, so the test reads what the surface hands the target.
const seen = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock("@/components/ui/pressable", async () => {
  const React = await import("react");
  // A press target as the browser sees it: the role, the name and a
  // click that runs the press. The custom actions stay on the props the
  // surface handed over.
  return {
    Pressable: React.forwardRef(function Press(
      props: Record<string, unknown>,
      ref: React.Ref<unknown>,
    ) {
      seen.props.push(props);
      return React.createElement("div", {
        role: props.accessibilityRole as string,
        "aria-label": props.accessibilityLabel as string,
        tabIndex: 0,
        ref,
        onClick: props.onPress as () => void,
      });
    }),
  };
});

import { SwipePress } from "./swipe-press";

function setUp(onStep = vi.fn()) {
  render(
    <GestureHandlerRootView>
      <SwipePress label="add task" at={1} count={4} onStep={onStep} testID="add-button">
        <></>
      </SwipePress>
    </GestureHandlerRootView>,
  );
  const target = screen.getByRole("button", { name: "add task" });
  const props = seen.props.at(-1) ?? {};
  return { onStep, target, props };
}

type Fired = { nativeEvent: { actionName: string } };

describe("the button's custom actions", () => {
  it("offers the commands and both tabs", () => {
    const { props } = setUp();

    expect(props.accessibilityActions).toEqual([
      { name: "commands", label: "Open commands" },
      { name: "next", label: "Next tab" },
      { name: "previous", label: "Previous tab" },
    ]);
  });

  it("runs the job each action names", () => {
    const { onStep, props } = setUp();
    const fire = (actionName: string) =>
      act(() => {
        (props.onAccessibilityAction as (event: Fired) => void)({
          nativeEvent: { actionName },
        });
      });

    fire("commands");
    expect(onStep).toHaveBeenLastCalledWith("commands");
    fire("next");
    expect(onStep).toHaveBeenLastCalledWith("next");
    fire("previous");
    expect(onStep).toHaveBeenLastCalledWith("previous");
  });

  it("ignores an action it does not carry", () => {
    const { onStep, props } = setUp();

    act(() => {
      (props.onAccessibilityAction as (event: Fired) => void)({
        nativeEvent: { actionName: "increment" },
      });
    });

    expect(onStep).not.toHaveBeenCalled();
  });
});

describe("the button's press and keys", () => {
  it("runs the press on a tap", () => {
    const { onStep, target } = setUp();

    fireEvent.click(target);

    expect(onStep).toHaveBeenCalledWith("press");
  });

  it("maps the arrow keys while it holds focus", () => {
    const { onStep, target } = setUp();
    target.focus();

    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(onStep).toHaveBeenLastCalledWith("commands");
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onStep).toHaveBeenLastCalledWith("next");
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(onStep).toHaveBeenLastCalledWith("previous");
  });

  it("leaves the arrows alone when another control holds focus", () => {
    const { onStep } = setUp();
    document.body.focus();

    fireEvent.keyDown(document, { key: "ArrowDown" });

    expect(onStep).not.toHaveBeenCalled();
  });
});
