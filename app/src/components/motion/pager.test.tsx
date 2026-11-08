import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { placeBox } from "@/testing/layout";
import { Pager } from "./pager";

const width = 390;

beforeAll(() => {
  // React Native Web reports onLayout through a ResizeObserver. This one
  // reports each element once, after the test has placed its box.
  window.ResizeObserver = class {
    constructor(private report: ResizeObserverCallback) {}
    observe(target: Element) {
      setTimeout(() =>
        this.report([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver),
      );
    }
    unobserve() {}
    disconnect() {}
  };
});

let mounts = 0;
function Live({ page }: { page: number }) {
  const [mount] = React.useState(() => ++mounts);
  return <Text testID="live">{`page ${page}, mount ${mount}`}</Text>;
}

function Screen({ onRender, onPage }: { onRender: () => void; onPage?: (next: number) => void }) {
  const [index, setIndex] = React.useState(0);
  onRender();
  return (
    <GestureHandlerRootView>
      <Pager
        testID="pager"
        index={index}
        bounds={{ first: 0, last: 2 }}
        onPage={(next) => {
          onPage?.(next);
          setIndex(next);
        }}
        renderPreview={(page) => <Text>{`preview ${page}`}</Text>}
      >
        <Live page={index} />
      </Pager>
    </GestureHandlerRootView>
  );
}

function pointer(type: string, x: number, init: PointerEventInit = {}) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: 300,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    ...init,
  });
}

/** A swipe from `from` to `to`, in steps, and a release. */
async function swipe(host: HTMLElement, from: number, to: number, end = "pointerup") {
  await act(async () => {
    host.dispatchEvent(pointer("pointerdown", from));
  });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await act(async () => {
      host.dispatchEvent(pointer("pointermove", from + ((to - from) * i) / steps));
      await new Promise((resolve) => setTimeout(resolve, 16));
    });
  }
  await act(async () => {
    host.dispatchEvent(pointer(end, to));
  });
}

async function mountScreen(onPage?: (next: number) => void) {
  const onRender = vi.fn();
  render(<Screen onRender={onRender} onPage={onPage} />);
  const host = screen.getByTestId("pager");
  placeBox(host, { x: 0, y: 0, width, height: 600 });
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return { host, onRender };
}

describe("Pager", () => {
  it("sets pan-y in the gesture config, so the host computes it", async () => {
    const { host } = await mountScreen();
    expect(getComputedStyle(host).touchAction).toBe("pan-y");
  });

  it("keys the live cell on index", async () => {
    mounts = 0;
    const { host } = await mountScreen();
    expect(screen.getByTestId("live").textContent).toBe("page 0, mount 1");
    await swipe(host, 300, 120);
    await waitFor(() =>
      expect(screen.getByTestId("live").textContent).toBe("page 1, mount 2"),
    );
  });

  it("commits a swipe once and renders the screen once for it", async () => {
    const onPage = vi.fn();
    const { host, onRender } = await mountScreen(onPage);
    const before = onRender.mock.calls.length;
    await swipe(host, 300, 120);
    await waitFor(() => expect(onPage).toHaveBeenCalledWith(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(onPage).toHaveBeenCalledTimes(1);
    expect(onRender.mock.calls.length - before).toBe(1);
  });

  it("moves two pages for two fast flicks", async () => {
    const onPage = vi.fn();
    const { host } = await mountScreen(onPage);
    await swipe(host, 300, 200);
    await swipe(host, 300, 200);
    await waitFor(() => expect(onPage).toHaveBeenCalledTimes(2));
    expect(onPage.mock.calls).toEqual([[1], [2]]);
    await waitFor(() =>
      expect(screen.getByTestId("live").textContent).toMatch(/^page 2,/),
    );
  });

  it("returns a short drag with no commit", async () => {
    const onPage = vi.fn();
    const { host } = await mountScreen(onPage);
    await swipe(host, 300, 260);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(onPage).not.toHaveBeenCalled();
  });

  it("never commits a cancelled swipe", async () => {
    const onPage = vi.fn();
    const { host } = await mountScreen(onPage);
    await swipe(host, 300, 60, "pointercancel");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(onPage).not.toHaveBeenCalled();
  });

  it("never passes a closed end", async () => {
    const onPage = vi.fn();
    const { host } = await mountScreen(onPage);
    await swipe(host, 60, 360);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(onPage).not.toHaveBeenCalled();
  });
});
