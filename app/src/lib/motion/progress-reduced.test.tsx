import "@/testing/reduced-motion";
import * as React from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSharedValue } from "react-native-reanimated";
import { timing, useProgress } from "./progress";

/** Flushes promises and microtasks, but runs no timer and no frame. */
const flush = () => act(async () => {});

describe("with reduced motion", () => {
  it("lands timing at once and still runs done", async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    let read = () => -1;
    function Probe() {
      const value = useSharedValue(0);
      React.useEffect(() => {
        value.set(timing(1, 300, done));
      }, [value]);
      read = () => value.get();
      return null;
    }
    render(<Probe />);
    await flush();
    expect(read()).toBe(1);
    expect(done).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("holds the end value and settles with no clock time", async () => {
    vi.useFakeTimers();
    const onSettled = vi.fn();
    let read = () => -1;
    function Clock({ open }: { open: boolean }) {
      const progress = useProgress(open, { ms: 300, onSettled });
      read = () => progress.value;
      return null;
    }
    const view = render(<Clock open={false} />);
    view.rerender(<Clock open />);
    await flush();
    expect(read()).toBe(1);
    expect(onSettled.mock.calls).toEqual([[1]]);
    vi.useRealTimers();
  });
});
