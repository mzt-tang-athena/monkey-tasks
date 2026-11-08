import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type { HoldKind } from "@/lib/motion/tokens";
import { placeBox } from "@/testing/layout";
import { createDragSurface } from "./drag-surface";

type Task = { name: string };
const Drag = createDragSurface<Task, string>();

function Watch({ onRender }: { onRender: (dragging: boolean) => void }) {
  onRender(Drag.useDragging());
  return null;
}

function Harness({
  task,
  hold = "grip",
  onDrop,
  renderGhost,
  onRender = () => {},
}: {
  task: Task;
  hold?: HoldKind;
  onDrop: (task: Task, target: string) => void;
  renderGhost: (task: Task) => React.ReactNode;
  onRender?: (dragging: boolean) => void;
}) {
  return (
    <GestureHandlerRootView>
      <Drag.Root onDrop={onDrop} renderGhost={renderGhost}>
        <Watch onRender={onRender} />
        <Drag.Source testID="source" payload={task} hold={hold}>
          <Text>{task.name}</Text>
        </Drag.Source>
        <Drag.Zone testID="zone:a" target="a" />
        <Drag.Zone testID="zone:b" target="b" />
      </Drag.Root>
    </GestureHandlerRootView>
  );
}

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

function layOut() {
  placeBox(screen.getByTestId("source"), { x: 0, y: 0, width: 200, height: 40 });
  placeBox(screen.getByTestId("zone:a"), { x: 0, y: 100, width: 200, height: 50 });
  placeBox(screen.getByTestId("zone:b"), { x: 0, y: 200, width: 200, height: 50 });
}

/** Presses the source, waits out `hold`, moves to each point, releases. */
async function drag(points: [number, number][], hold = 0) {
  const source = screen.getByTestId("source");
  await act(async () => {
    source.dispatchEvent(pointer("pointerdown", 20, 20));
  });
  await wait(hold);
  for (const [x, y] of points) {
    await act(async () => {
      source.dispatchEvent(pointer("pointermove", x, y));
    });
    await wait(16);
  }
  const [x, y] = points[points.length - 1];
  await act(async () => {
    source.dispatchEvent(pointer("pointerup", x, y));
  });
  await wait(50);
}

describe("createDragSurface", () => {
  it("renders once at pickup, nothing per move, and drops once on the target", async () => {
    const task = { name: "Call Mum" };
    const onDrop = vi.fn();
    const renderGhost = vi.fn((t: Task) => <Text>{`ghost ${t.name}`}</Text>);
    const renders: boolean[] = [];
    render(
      <Harness task={task} onDrop={onDrop} renderGhost={renderGhost} onRender={(d) => renders.push(d)} />,
    );
    layOut();
    await drag([
      [20, 30],
      [20, 60],
      [20, 120],
      [20, 180],
      [20, 220],
      [20, 225],
    ]);
    expect(renders).toEqual([false, true, false]);
    expect(renderGhost).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith(task, "b");
  });

  it("reads the newest payload at the drop", async () => {
    const onDrop = vi.fn();
    const ghost = (t: Task) => <Text>{t.name}</Text>;
    const view = render(<Harness task={{ name: "old" }} onDrop={onDrop} renderGhost={ghost} />);
    layOut();
    const source = screen.getByTestId("source");
    await act(async () => {
      source.dispatchEvent(pointer("pointerdown", 20, 20));
    });
    for (const y of [40, 80, 120]) {
      await act(async () => {
        source.dispatchEvent(pointer("pointermove", 20, y));
      });
      await wait(16);
    }
    view.rerender(<Harness task={{ name: "new" }} onDrop={onDrop} renderGhost={ghost} />);
    await act(async () => {
      source.dispatchEvent(pointer("pointerup", 20, 120));
    });
    await wait(50);
    expect(onDrop).toHaveBeenCalledWith({ name: "new" }, "a");
  });

  it("drops on nothing outside every zone", async () => {
    const onDrop = vi.fn();
    render(<Harness task={{ name: "x" }} onDrop={onDrop} renderGhost={() => null} />);
    layOut();
    await drag([
      [20, 40],
      [20, 80],
      [20, 170],
    ]);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("lifts a row only after its hold", async () => {
    const onDrop = vi.fn();
    render(<Harness task={{ name: "x" }} hold="row" onDrop={onDrop} renderGhost={() => null} />);
    layOut();
    await drag([[20, 120]], 0);
    expect(onDrop).not.toHaveBeenCalled();
    await drag(
      [
        [20, 30],
        [20, 80],
        [20, 120],
      ],
      350,
    );
    expect(onDrop).toHaveBeenCalledWith({ name: "x" }, "a");
  });

  it.each([
    ["row", "pan-y"],
    ["pill", "pan-y"],
    ["grip", "none"],
  ] as const)("sets touch-action for a %s source to %s", (hold, value) => {
    render(<Harness task={{ name: "x" }} hold={hold} onDrop={() => {}} renderGhost={() => null} />);
    expect(getComputedStyle(screen.getByTestId("source")).touchAction).toBe(value);
  });
});
