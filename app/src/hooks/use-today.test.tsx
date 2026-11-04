import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppState } from "react-native";
import { useToday } from "./use-today";

describe("useToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts on the start of the current day", () => {
    vi.setSystemTime(new Date(2026, 9, 26, 15, 30));
    const { result } = renderHook(() => useToday());

    expect(result.current.getTime()).toBe(new Date(2026, 9, 26).getTime());
  });

  it("keeps one identity while the day holds", () => {
    vi.setSystemTime(new Date(2026, 9, 26, 15, 30));
    const { result, rerender } = renderHook(() => useToday());
    const first = result.current;

    rerender();
    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(result.current).toBe(first);
  });

  it("moves to the next day at midnight", () => {
    vi.setSystemTime(new Date(2026, 9, 26, 23, 59));
    const { result } = renderHook(() => useToday());

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(result.current.getTime()).toBe(new Date(2026, 9, 27).getTime());
  });

  it("catches up when the app returns to the foreground", () => {
    vi.setSystemTime(new Date(2026, 9, 26, 22, 0));
    let onChange: (state: string) => void = () => undefined;
    vi.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      onChange = listener as (state: string) => void;
      return { remove: () => undefined };
    });
    const { result } = renderHook(() => useToday());

    // The phone slept through midnight: no timer ran.
    vi.setSystemTime(new Date(2026, 9, 27, 7, 0));
    act(() => {
      onChange("active");
    });

    expect(result.current.getTime()).toBe(new Date(2026, 9, 27).getTime());
  });
});
