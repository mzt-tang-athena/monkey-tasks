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

  it("turns to the next tab on a page landing", () => {
    const { result } = renderHook(() => useListTabState());
    act(() => result.current.onPage(1));
    expect(result.current.tab).toBe("Tasks");
    expect(result.current.index).toBe(1);
  });

  it("steps from Main when the open list note vanishes, then pages", () => {
    const { result, rerender } = renderHook(() => useListTabState());
    act(() => result.current.setTab("Finance"));
    expect(result.current.tab).toBe("Finance");
    expect(result.current.index).toBe(2);

    state.tabs = ["Main", "Tasks"];
    rerender();
    expect(result.current.tab).toBe("Main");
    expect(result.current.index).toBe(0);

    // A landing must move from the derived tab. The stale selection
    // would leave the pager on a blank page.
    act(() => result.current.onPage(1));
    expect(result.current.tab).toBe("Tasks");
  });

  it("stays put on a landing at a closed end", () => {
    const { result, rerender } = renderHook(() => useListTabState());
    act(() => result.current.setTab("Finance"));
    state.tabs = ["Main", "Tasks"];
    rerender();
    act(() => result.current.onPage(-1));
    expect(result.current.tab).toBe("Main");
    act(() => result.current.onPage(2));
    expect(result.current.tab).toBe("Main");
  });
});
