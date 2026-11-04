import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PointerEvent as RNPointerEvent } from "react-native";
import type { TaskItem } from "@/types/task";
import { DropZoneMap } from "@/features/planner/lib/dropzone";
import { drag } from "@/theme/tokens";
import { useDragSession, type DragPatch } from "./use-drag-session";

/** A zone that reports a fixed rect, as a laid-out view does. */
function zone(x: number, y: number, w: number, h: number) {
  return {
    measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
      cb(x, y, w, h),
  };
}

const groceries: TaskItem = {
  id: "g",
  uri: "content://vault/Tasks/Groceries.md",
  fileName: "Groceries.md",
  name: "Groceries",
  text: "",
  body: "",
  data: { kind: "[[tasks]]", created: "2026-10-01", due: "2026-10-26T09:30" },
};

/** One resolve for every mode: an hour slot or a day cell. */
function resolve(hit: string): DragPatch | null {
  if (hit.startsWith("hour:")) {
    return { due: `2026-10-26T${hit.slice(5).padStart(2, "0")}:30` };
  }
  if (hit.startsWith("day:")) {
    return { due: hit.slice(4) };
  }
  return null;
}

function setup(pointerPickup: boolean) {
  const zones = new DropZoneMap();
  zones.set("hour:10", zone(0, 0, 100, 100));
  zones.set("day:2026-10-27", zone(200, 0, 100, 100));
  zones.set("list:focus", zone(400, 0, 100, 100));
  const write = vi.fn();
  const view = renderHook(() =>
    useDragSession({ zones, resolve, write, pointerPickup }),
  );
  return { ...view, write };
}

describe("useDragSession through the gesture api", () => {
  it("writes the hour's patch when a drag drops on a ruler row", () => {
    const { result, write } = setup(false);

    act(() => result.current.api.pickup(groceries, 50, 50, "row"));
    expect(result.current.lifted).toEqual({ task: groceries, phase: "picked" });
    act(() => result.current.api.move(50, 50));
    expect(result.current.dropTargets.hover.get()).toBe("hour:10");
    act(() => result.current.api.drop());

    expect(write).toHaveBeenCalledWith(groceries, { due: "2026-10-26T10:30" });
    expect(result.current.lifted).toBeNull();
    expect(result.current.dropTargets.hover.get()).toBeNull();
  });

  it("writes the day's patch when a drag drops on a week column or month cell", () => {
    const { result, write } = setup(false);

    act(() => result.current.api.pickup(groceries, 250, 50, "row"));
    act(() => result.current.api.move(250, 50));
    expect(result.current.dropTargets.hover.get()).toBe("day:2026-10-27");
    act(() => result.current.api.drop());

    expect(write).toHaveBeenCalledWith(groceries, { due: "2026-10-27" });
  });

  it("writes nothing when the drop lands outside every zone", () => {
    const { result, write } = setup(false);

    act(() => result.current.api.pickup(groceries, 50, 50, "row"));
    act(() => result.current.api.move(900, 900));
    act(() => result.current.api.drop());

    expect(write).not.toHaveBeenCalled();
    expect(result.current.lifted).toBeNull();
  });

  it("ignores a zone that takes no drop", () => {
    const { result, write } = setup(false);

    act(() => result.current.api.pickup(groceries, 450, 50, "row"));
    act(() => result.current.api.move(450, 50));
    expect(result.current.dropTargets.hover.get()).toBeNull();
    act(() => result.current.api.drop());

    expect(write).not.toHaveBeenCalled();
  });

  it("shows the hold cue, then the lift once the hold is armed", () => {
    vi.useFakeTimers();
    try {
      const { result } = setup(false);

      act(() => result.current.api.hold?.(groceries, "row"));
      expect(result.current.lifted).toEqual({ task: groceries, phase: "hold" });
      act(() => {
        vi.advanceTimersByTime(drag.pickMs + 10);
      });
      expect(result.current.lifted).toEqual({ task: groceries, phase: "picked" });
      act(() => result.current.api.releaseHold?.());
      expect(result.current.lifted).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the identity of the api and the press handlers across renders", () => {
    const { result, rerender } = setup(true);
    const first = result.current;

    rerender();

    expect(result.current.api).toBe(first.api);
    expect(result.current.startDrag).toBe(first.startDrag);
    expect(result.current.consumeClick).toBe(first.consumeClick);
    expect(result.current.dropTargets).toBe(first.dropTargets);
  });
});

describe("the click guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function dropOnZone(pointerPickup: boolean) {
    const view = setup(pointerPickup);
    act(() => view.result.current.api.pickup(groceries, 50, 50, "row"));
    act(() => view.result.current.api.move(50, 50));
    act(() => view.result.current.api.drop());
    return view.result.current;
  }

  it("arms after a drop on web, in every mode, and clears once read", () => {
    const session = dropOnZone(true);

    expect(session.consumeClick()).toBe(true);
    expect(session.consumeClick()).toBe(false);
  });

  it("lets the click through after a drop on native", () => {
    const session = dropOnZone(false);

    expect(session.consumeClick()).toBe(false);
  });

  it("clears by itself when no click follows", () => {
    const session = dropOnZone(true);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(session.consumeClick()).toBe(false);
  });
});

describe("useDragSession through the pointer events", () => {
  function press(x: number, y: number, pointerType: string): RNPointerEvent {
    return { nativeEvent: { pageX: x, pageY: y, pointerType } } as never;
  }

  it("promotes a mouse press past the threshold, and drops on a zone", () => {
    const { result, write } = setup(true);
    const { onPointerMove, onPointerUp } = result.current.pointerHandlers;

    act(() => result.current.startDrag(groceries, press(10, 10, "mouse")));
    // A small wiggle stays a press.
    act(() => onPointerMove?.(press(12, 12, "mouse")));
    expect(result.current.dragging).toBeNull();
    act(() => onPointerMove?.(press(60, 60, "mouse")));
    expect(result.current.dragging).toBe(groceries);
    act(() => onPointerMove?.(press(50, 50, "mouse")));
    act(() => onPointerUp?.());

    expect(write).toHaveBeenCalledWith(groceries, { due: "2026-10-26T10:30" });
    expect(result.current.dragging).toBeNull();
  });

  it("drops the press when a touch moves before the hold completes", () => {
    const { result, write } = setup(true);
    const { onPointerMove, onPointerUp } = result.current.pointerHandlers;

    act(() => result.current.startDrag(groceries, press(10, 10, "touch")));
    act(() => onPointerMove?.(press(60, 60, "touch")));
    act(() => onPointerUp?.());

    expect(result.current.dragging).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
});
