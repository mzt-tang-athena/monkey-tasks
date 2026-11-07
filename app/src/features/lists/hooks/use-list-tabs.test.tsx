import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useListTabState } from "./use-list-tabs";

const state = vi.hoisted(() => ({ tabs: ["Main", "Tasks", "Finance"] }));

vi.mock("@/stores/tasks/selectors", () => ({
  useListTabs: () => state.tabs,
}));

describe("useListTabState", () => {
  beforeEach(() => {
    state.tabs = ["Main", "Tasks", "Finance"];
  });

  it("turns to the next tab on a swipe", () => {
    const { result } = renderHook(() => useListTabState());
    act(() => result.current.onPage("left"));
    expect(result.current.tab).toBe("Tasks");
  });

  it("steps from Main when the open list note vanishes, then swipes", () => {
    const { result, rerender } = renderHook(() => useListTabState());
    act(() => result.current.setTab("Finance"));
    expect(result.current.tab).toBe("Finance");

    state.tabs = ["Main", "Tasks"];
    rerender();
    expect(result.current.tab).toBe("Main");
    expect(result.current.canGo("left")).toBe(true);

    // The swipe must move from Main to Tasks. The stale selection would
    // leave the pager on a blank page.
    act(() => result.current.onPage("left"));
    expect(result.current.tab).toBe("Tasks");
  });

  it("stays put on a swipe toward an end", () => {
    const { result, rerender } = renderHook(() => useListTabState());
    act(() => result.current.setTab("Finance"));
    state.tabs = ["Main", "Tasks"];
    rerender();
    act(() => result.current.onPage("right"));
    expect(result.current.tab).toBe("Main");
  });
});
