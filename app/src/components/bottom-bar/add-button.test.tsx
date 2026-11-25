import * as React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  pathname: "/",
  show: vi.fn(),
  add: vi.fn(),
  surface: [] as Record<string, unknown>[],
}));

vi.mock("expo-router", () => ({
  router: { navigate: state.navigate },
  usePathname: () => state.pathname,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// The surface is the seam: its swipes cannot be sent from jsdom, so the
// test reads the steps the button hands it and runs them.
vi.mock("@/components/motion/swipe-press", () => ({
  SwipePress: (props: Record<string, unknown>) => {
    state.surface.push(props);
    return null;
  },
}));

import { BottomBar } from "./bottom-bar";
import { AddButton } from "./add-button";
import { CommandPaneContext } from "@/hooks/use-command-pane";

function setUp() {
  render(
    <CommandPaneContext.Provider value={{ show: state.show }}>
      <BottomBar action={<AddButton label="add task" onPress={state.add} />} />
    </CommandPaneContext.Provider>,
  );
  const props = state.surface.at(-1) ?? {};
  const step = props.onStep as (action: string) => void;
  return { props, step };
}

beforeEach(() => {
  state.pathname = "/";
  state.surface = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("the Add button", () => {
  it("carries the bar's tab and its count", () => {
    const { props } = setUp();

    expect(props.label).toBe("add task");
    expect(props.at).toBe(0);
    expect(props.count).toBe(4);
  });

  it("adds on a press", () => {
    const { step } = setUp();

    act(() => step("press"));

    expect(state.add).toHaveBeenCalledTimes(1);
    expect(state.navigate).not.toHaveBeenCalled();
    expect(state.show).not.toHaveBeenCalled();
  });

  it("opens the commands on a swipe down", () => {
    const { step } = setUp();

    act(() => step("commands"));

    expect(state.show).toHaveBeenCalledTimes(1);
  });

  it("moves one tab either way", () => {
    state.pathname = "/planner";
    const { step } = setUp();

    act(() => step("next"));
    expect(state.navigate).toHaveBeenLastCalledWith("/inbox");
    act(() => step("previous"));
    expect(state.navigate).toHaveBeenLastCalledWith("/");
  });

  it("stops at either end", () => {
    const { step } = setUp();

    act(() => step("previous"));
    expect(state.navigate).not.toHaveBeenCalled();

    state.pathname = "/journal";
    state.surface = [];
    const last = setUp();
    act(() => last.step("next"));
    expect(state.navigate).not.toHaveBeenCalled();
  });
});
