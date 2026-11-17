import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  setCompletedOpen,
  toggleCompleted,
  useCompletedOpen,
} from "./folded-completed";

describe("the folded Completed group", () => {
  it("starts folded and opens on a toggle", () => {
    const { result } = renderHook(() => useCompletedOpen("Main"));

    expect(result.current).toBe(false);
    act(() => toggleCompleted("Main"));
    expect(result.current).toBe(true);
    act(() => toggleCompleted("Main"));
    expect(result.current).toBe(false);
  });

  it("keeps one tab's fold apart from another", () => {
    const main = renderHook(() => useCompletedOpen("Main"));
    const errands = renderHook(() => useCompletedOpen("Errands"));

    act(() => setCompletedOpen("Main", true));

    expect(main.result.current).toBe(true);
    expect(errands.result.current).toBe(false);

    act(() => setCompletedOpen("Main", false));
    expect(main.result.current).toBe(false);
  });
});
