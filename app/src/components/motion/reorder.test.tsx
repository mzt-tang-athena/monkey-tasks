import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { placeBox } from "@/testing/layout";
import { createReorderSurface, type ReorderEvent } from "./reorder";

type Row = { name: string };

const List = createReorderSurface<Row>();

/** A row of one group: its place in the group's data, and the group's
    size. Only the rows in `mounted` render, as a scrolled long group
    mounts a window past its first row. */
type Shown = { name: string; index: number };

function Screen({
  rows,
  count,
  onReorder,
}: {
  rows: Shown[];
  count: number;
  onReorder: (event: ReorderEvent<Row>) => void;
}) {
  return (
    <GestureHandlerRootView>
      <List.Root onReorder={onReorder} renderGhost={() => null}>
        {rows.map(({ name, index }) => (
          <List.Item
            key={name}
            payload={{ name }}
            id={name}
            group="Today"
            index={index}
            count={count}
            testID={`reorder-item:${name}`}
          >
            <List.Grip testID={`reorder-grip:${name}`} />
          </List.Item>
        ))}
      </List.Root>
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

describe("createReorderSurface", () => {
  it("drops a row of a partly mounted group by its data index", async () => {
    const onReorder = vi.fn();
    const rows = [
      { name: "Delta", index: 3 },
      { name: "Echo", index: 4 },
    ];
    render(<Screen rows={rows} count={5} onReorder={onReorder} />);
    rows.forEach(({ name }, at) => {
      placeBox(screen.getByTestId(`reorder-item:${name}`), {
        x: 0,
        y: at * 48,
        width: 390,
        height: 48,
      });
      placeBox(screen.getByTestId(`reorder-grip:${name}`), {
        x: 360,
        y: at * 48,
        width: 44,
        height: 44,
      });
    });
    const grip = screen.getByTestId("reorder-grip:Echo");

    // The grip claims on the press. The move that follows is the one
    // that crosses the slot above.
    await act(async () => {
      grip.dispatchEvent(pointer("pointerdown", 370, 60));
    });
    await wait(50);
    expect(screen.getByTestId("drag-ghost"), "the grip picked the row up").toBeTruthy();

    // The grip keeps no pointer capture, so the move past its box leaves
    // it first. The second move carries the new point.
    for (let step = 0; step < 2; step += 1) {
      await act(async () => {
        grip.dispatchEvent(pointer("pointermove", 370, 30));
      });
      await wait(16);
    }
    await act(async () => {
      grip.dispatchEvent(pointer("pointerup", 370, 30));
    });
    await wait(50);

    expect(onReorder.mock.calls).toEqual([
      [{ payload: { name: "Echo" }, group: "Today", from: 4, to: 3 }],
    ]);
  });
});
