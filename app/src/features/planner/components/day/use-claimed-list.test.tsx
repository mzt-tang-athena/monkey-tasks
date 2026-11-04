import * as React from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import type { DragApi, LiftState } from "../drag";
import { plannerListValue } from "@/features/planner/testing/test-planner-list";
import { useClaimedList } from "./use-claimed-list";

const task = { id: "t", name: "Task" } as TaskItem;

function makeApi(): DragApi {
  return {
    hold: vi.fn(),
    releaseHold: vi.fn(),
    pickup: vi.fn(),
    move: vi.fn(),
    drop: vi.fn(),
  } as unknown as DragApi;
}

const lift = (phase: string) => ({ phase, task }) as unknown as LiftState;

describe("useClaimedList", () => {
  it("keeps one api and one dragStart while the lift changes", () => {
    const api = makeApi();
    const dragStart = vi.fn();
    const claim = vi.fn();
    // The hold starts, arms, and picks up: three lift changes in one
    // gesture. The native pan is memoized on the api, so a new api
    // here rebuilds the pan mid-drag and drops the gesture.
    const lifts: LiftState[] = [null, lift("hold"), lift("armed"), lift("drag")];
    const hook = renderHook(
      ({ lifted }: { lifted: LiftState }) => {
        const live = React.useMemo(
          () => plannerListValue({ api, dragStart, lifted }),
          [lifted],
        );
        return useClaimedList(live, claim);
      },
      { initialProps: { lifted: lifts[0] } },
    );
    const apis = new Set<DragApi | undefined>([hook.result.current.api]);
    const starts = new Set<unknown>([hook.result.current.dragStart]);
    for (const lifted of lifts.slice(1)) {
      hook.rerender({ lifted });
      apis.add(hook.result.current.api);
      starts.add(hook.result.current.dragStart);
    }

    expect(apis.size).toBe(1);
    expect(starts.size).toBe(1);
    expect(hook.result.current.lifted).toBe(lifts[3]);
  });

  it("claims the swipe before a pickup or a drag start", () => {
    const api = makeApi();
    const dragStart = vi.fn();
    const claim = vi.fn();
    const { result } = renderHook(() =>
      useClaimedList(plannerListValue({ api, dragStart }), claim),
    );

    result.current.api!.pickup(task, 1, 2, "row");
    expect(claim).toHaveBeenCalledTimes(1);
    expect(api.pickup).toHaveBeenCalledWith(task, 1, 2, "row");

    const event = {} as never;
    result.current.dragStart(task, event, "pill");
    expect(claim).toHaveBeenCalledTimes(2);
    expect(dragStart).toHaveBeenCalledWith(task, event, "pill");
  });

  it("leaves the api absent when the list has none", () => {
    const { result } = renderHook(() =>
      useClaimedList(plannerListValue({ api: undefined }), vi.fn()),
    );

    expect(result.current.api).toBeUndefined();
  });
});
