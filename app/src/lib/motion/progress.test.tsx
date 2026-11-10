import * as React from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useProgress } from "./progress";

function Clock({ open, onSettled }: { open: boolean; onSettled: (at: 0 | 1) => void }) {
  useProgress(open, { ms: 100, onSettled });
  return null;
}

const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe("useProgress", () => {
  it("starts at its target with no run", async () => {
    const onSettled = vi.fn();
    render(<Clock open onSettled={onSettled} />);
    await wait(200);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("settles once per run, at its end", async () => {
    const onSettled = vi.fn();
    const view = render(<Clock open={false} onSettled={onSettled} />);
    view.rerender(<Clock open onSettled={onSettled} />);
    await wait(20);
    expect(onSettled).not.toHaveBeenCalled();
    await wait(250);
    expect(onSettled.mock.calls).toEqual([[1]]);
    view.rerender(<Clock open={false} onSettled={onSettled} />);
    await wait(250);
    expect(onSettled.mock.calls).toEqual([[1], [0]]);
    view.unmount();
    expect(onSettled).toHaveBeenCalledTimes(2);
  });

  it("settles once at unmount when the run has not ended", async () => {
    const onSettled = vi.fn();
    const view = render(<Clock open={false} onSettled={onSettled} />);
    view.rerender(<Clock open onSettled={onSettled} />);
    await wait(20);
    view.unmount();
    expect(onSettled.mock.calls).toEqual([[1]]);
    await wait(250);
    expect(onSettled.mock.calls).toEqual([[1]]);
  });

  it("never settles a superseded run", async () => {
    const onSettled = vi.fn();
    const view = render(<Clock open={false} onSettled={onSettled} />);
    view.rerender(<Clock open onSettled={onSettled} />);
    await wait(20);
    view.rerender(<Clock open={false} onSettled={onSettled} />);
    await wait(300);
    expect(onSettled.mock.calls).toEqual([[0]]);
  });
});
