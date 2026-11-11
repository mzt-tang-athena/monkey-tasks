import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { placeBox } from "@/testing/layout";
import { Split, SplitStill } from "./split";

const box = { x: 0, y: 0, width: 400, height: 628 };

function pointer(type: string, x: number, y: number) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
  });
}

const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

/** Gives the split the size a day body has, so its worklet can clamp. */
function layOut() {
  placeBox(screen.getByTestId("split"), box);
  placeBox(screen.getByTestId("split:top"), { x: 0, y: 0, width: 400, height: 300 });
  // The grip sits on the divider, under the top pane. Gesture handler's
  // web build hit-tests the pointer against this box.
  placeBox(screen.getByTestId("split:grip"), { x: 164, y: 300, width: 72, height: 28 });
}

async function dragGrip(points: [number, number][]) {
  const grip = screen.getByTestId("split:grip");
  await act(async () => {
    grip.dispatchEvent(pointer("pointerdown", 200, 300));
  });
  for (const [x, y] of points) {
    await act(async () => {
      grip.dispatchEvent(pointer("pointermove", x, y));
    });
    await wait(16);
  }
  const [x, y] = points[points.length - 1];
  await act(async () => {
    grip.dispatchEvent(pointer("pointerup", x, y));
  });
  await wait(50);
}

describe("Split", () => {
  it("reports the grabber as an adjustable slider with a value", () => {
    render(
      <GestureHandlerRootView>
        <Split
          testID="split"
          fraction={0.5}
          onResize={() => undefined}
          minTop={100}
          minBottom={100}
          top={<Text>top</Text>}
          bottom={<Text>bottom</Text>}
        />
      </GestureHandlerRootView>,
    );

    const grip = screen.getByTestId("split:grip");
    expect(grip.getAttribute("role")).toBe("slider");
    expect(grip.getAttribute("aria-valuenow")).toBe("50");
    expect(grip.getAttribute("aria-label")).toBe("resize timeline");
  });

  it("lays both panes out by fraction, with a grabber that claims the touch", async () => {
    render(
      <GestureHandlerRootView>
        <Split
          testID="split"
          fraction={0.5}
          onResize={() => {}}
          minTop={150}
          minBottom={150}
          top={<Text>timeline</Text>}
          bottom={<Text>list</Text>}
        />
      </GestureHandlerRootView>,
    );
    await wait(50);

    const top = screen.getByTestId("split:top");
    const bottom = screen.getByTestId("split:bottom");
    expect(Number(top.style.flexGrow)).toBeCloseTo(0.5, 3);
    expect(Number(bottom.style.flexGrow)).toBeCloseTo(0.5, 3);
    expect(getComputedStyle(screen.getByTestId("split:grip")).touchAction).toBe("none");
  });

  it("follows the grip, stops at the limit, and reports once at the release", async () => {
    const onResize = vi.fn();
    render(
      <GestureHandlerRootView>
        <Split
          testID="split"
          fraction={0.5}
          onResize={onResize}
          minTop={150}
          minBottom={150}
          top={<Text>timeline</Text>}
          bottom={<Text>list</Text>}
        />
      </GestureHandlerRootView>,
    );
    layOut();

    await dragGrip([
      [200, 420],
      [200, 700],
    ]);

    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize.mock.calls[0][0]).toBeCloseTo(0.75, 3);
  });

  it("does not report a press that never moves", async () => {
    const onResize = vi.fn();
    render(
      <GestureHandlerRootView>
        <Split
          testID="split"
          fraction={0.4}
          onResize={onResize}
          minTop={150}
          minBottom={150}
          top={<Text>timeline</Text>}
          bottom={<Text>list</Text>}
        />
      </GestureHandlerRootView>,
    );
    layOut();

    await act(async () => {
      const grip = screen.getByTestId("split:grip");
      grip.dispatchEvent(pointer("pointerdown", 200, 310));
      grip.dispatchEvent(pointer("pointerup", 200, 310));
    });
    await wait(50);

    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize.mock.calls[0][0]).toBeCloseTo(0.4, 3);
  });
});

describe("SplitStill", () => {
  it("draws the same split with no grabber", async () => {
    render(
      <SplitStill
        testID="still"
        fraction={0.4}
        minTop={150}
        minBottom={150}
        top={<Text>timeline</Text>}
        bottom={<Text>list</Text>}
      />,
    );
    await wait(50);

    expect(screen.queryByTestId("still:grip")).toBeNull();
    expect(Number(screen.getByTestId("still:top").style.flexGrow)).toBeCloseTo(0.4, 3);
    expect(Number(screen.getByTestId("still:bottom").style.flexGrow)).toBeCloseTo(0.6, 3);
  });
});
