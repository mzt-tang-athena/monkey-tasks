import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startOfDay } from "@/utils/dates";
import { usePlannerRoute } from "./use-planner-route";

// The route is the planner's state: the URL names the mode and the
// day, and the hook reads them back and writes them out. The mock
// keeps one mutable params object, so a write is visible to the next
// read exactly as the real router makes it.

const route = vi.hoisted(() => ({
  params: {} as Record<string, string | string[]>,
  calls: [] as Record<string, string>[],
}));

vi.mock("expo-router", () => ({
  useLocalSearchParams: () => route.params,
  router: {
    setParams: (next: Record<string, string>) => {
      route.calls.push(next);
      Object.assign(route.params, next);
    },
  },
}));

function mount() {
  return renderHook(() => usePlannerRoute());
}

beforeEach(() => {
  route.params = {};
  route.calls = [];
});

describe("usePlannerRoute", () => {
  it("defaults to day mode on the start of today", async () => {
    const { result } = mount();

    expect(result.current.mode).toBe("day");
    expect(result.current.day.getTime()).toBe(startOfDay(new Date()).getTime());
  });

  it("reads the mode and day the params name", async () => {
    route.params = { mode: "week", day: "2026-10-22" };
    const { result } = mount();

    expect(result.current.mode).toBe("week");
    expect(result.current.day.getTime()).toBe(new Date(2026, 9, 22).getTime());
  });

  it("writes the day param on setDay and survives a remount", async () => {
    const { result, rerender, unmount } = mount();

    await act(async () => {
      result.current.setDay(new Date(2026, 9, 25));
    });

    expect(route.calls).toEqual([{ day: "2026-10-25" }]);
    rerender();
    expect(result.current.day.getTime()).toBe(new Date(2026, 9, 25).getTime());

    // A remount starts from the URL again, so the day is not lost.
    unmount();
    const remounted = mount().result;
    expect(remounted.current.day.getTime()).toBe(new Date(2026, 9, 25).getTime());
  });

  it("writes the day and day mode together on openDay", async () => {
    route.params = { mode: "month", day: "2026-10-01" };
    const { result, rerender } = mount();

    await act(async () => {
      result.current.openDay(new Date(2026, 9, 22));
    });

    expect(route.calls).toEqual([{ day: "2026-10-22", mode: "day" }]);
    rerender();
    expect(result.current.mode).toBe("day");
    expect(result.current.day.getTime()).toBe(new Date(2026, 9, 22).getTime());
  });

  it("falls back to today for a day param that is not a date", async () => {
    route.params = { day: "2026-02-30" };
    const { result } = mount();

    expect(result.current.day.getTime()).toBe(startOfDay(new Date()).getTime());
  });
});
