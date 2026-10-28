/* eslint-disable react-hooks/globals */
// The Probe pattern: the test reads the hook result through a module
// binding, which is the shape the rule forbids in app code.
import * as React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startOfDay } from "@/utils/dates";
import { usePlannerRoute, type PlannerRoute } from "./usePlannerRoute";

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

let latest: PlannerRoute | null = null;

function Probe() {
  latest = usePlannerRoute();
  return null;
}

async function mount(): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(React.createElement(Probe));
  });
  return renderer as unknown as ReactTestRenderer;
}

/** Re-render against the params the router now holds. */
async function refresh(renderer: ReactTestRenderer): Promise<void> {
  await act(async () => {
    renderer.update(React.createElement(Probe));
  });
}

beforeEach(() => {
  latest = null;
  route.params = {};
  route.calls = [];
});

describe("usePlannerRoute", () => {
  it("defaults to day mode on the start of today", async () => {
    await mount();

    expect(latest!.mode).toBe("day");
    expect(latest!.day.getTime()).toBe(startOfDay(new Date()).getTime());
  });

  it("reads the mode and day the params name", async () => {
    route.params = { mode: "week", day: "2026-10-22" };
    await mount();

    expect(latest!.mode).toBe("week");
    expect(latest!.day.getTime()).toBe(new Date(2026, 9, 22).getTime());
  });

  it("writes the day param on setDay and survives a remount", async () => {
    const renderer = await mount();

    await act(async () => {
      latest!.setDay(new Date(2026, 9, 25));
    });

    expect(route.calls).toEqual([{ day: "2026-10-25" }]);
    await refresh(renderer);
    expect(latest!.day.getTime()).toBe(new Date(2026, 9, 25).getTime());

    // A remount starts from the URL again, so the day is not lost.
    await act(async () => {
      renderer.unmount();
    });
    await mount();
    expect(latest!.day.getTime()).toBe(new Date(2026, 9, 25).getTime());
  });

  it("writes the day and day mode together on openDay", async () => {
    route.params = { mode: "month", day: "2026-10-01" };
    const renderer = await mount();

    await act(async () => {
      latest!.openDay(new Date(2026, 9, 22));
    });

    expect(route.calls).toEqual([{ day: "2026-10-22", mode: "day" }]);
    await refresh(renderer);
    expect(latest!.mode).toBe("day");
    expect(latest!.day.getTime()).toBe(new Date(2026, 9, 22).getTime());
  });

  it("falls back to today for a day param that is not a date", async () => {
    route.params = { day: "2026-02-30" };
    await mount();

    expect(latest!.day.getTime()).toBe(startOfDay(new Date()).getTime());
  });
});
