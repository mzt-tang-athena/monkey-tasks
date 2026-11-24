import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { placeBox } from "@/testing/layout";
import { readBreadcrumbs, resetBreadcrumbs } from "@/lib/breadcrumbs";
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
  group = "Today",
}: {
  rows: Shown[];
  count: number;
  onReorder: (event: ReorderEvent<Row>) => void;
  group?: string;
}) {
  return (
    <GestureHandlerRootView>
      <List.Root onReorder={onReorder} renderGhost={() => null}>
        {rows.map(({ name, index }) => (
          <List.Item
            key={`${group}:${name}`}
            payload={{ name }}
            id={name}
            group={group}
            index={index}
            count={count}
            testID={`reorder-item:${name}`}
          >
            <List.Grip testID={`reorder-grip:${name}`} label={`reorder ${name}`} />
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
    resetBreadcrumbs();
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
      [
        {
          payload: { name: "Echo" },
          group: "Today",
          from: 1,
          to: 0,
          keys: ["Delta", "Echo"],
        },
      ],
    ]);
    expect(readBreadcrumbs().map((crumb) => [crumb.kind, crumb.detail])).toEqual([
      ["drag-start", undefined],
      ["drag-drop", "Today 1->0"],
    ]);
  });

  it("reports each grip as a slider at the row's place", () => {
    render(
      <Screen
        rows={[
          { name: "Delta", index: 3 },
          { name: "Echo", index: 4 },
        ]}
        count={5}
        onReorder={() => undefined}
      />,
    );

    const grip = screen.getByTestId("reorder-grip:Echo");
    expect(grip.getAttribute("role")).toBe("slider");
    expect(grip.getAttribute("aria-label")).toBe("reorder Echo");
    expect(grip.getAttribute("aria-valuemin")).toBe("1");
    expect(grip.getAttribute("aria-valuemax")).toBe("5");
    expect(grip.getAttribute("aria-valuenow")).toBe("5");
  });

  it("picks up a row remounted under a new group", async () => {
    // A sort change moves every open row into another section key, so
    // the old cell unmounts after the new one has mounted. The old
    // cleanup must not delete the new row's entry.
    const onReorder = vi.fn();
    const rows = [
      { name: "Alpha", index: 0 },
      { name: "Bravo", index: 1 },
    ];
    const screenAt = (group: string) => (
      <Screen rows={rows} count={2} group={group} onReorder={onReorder} />
    );
    const { rerender } = render(screenAt("No date"));

    rerender(screenAt("my-order"));

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
    const grip = screen.getByTestId("reorder-grip:Alpha");

    await act(async () => {
      grip.dispatchEvent(pointer("pointerdown", 370, 12));
    });
    await wait(50);
    expect(
      screen.getByTestId("drag-ghost"),
      "the grip picked up the remounted row",
    ).toBeTruthy();

    for (let step = 0; step < 2; step += 1) {
      await act(async () => {
        grip.dispatchEvent(pointer("pointermove", 370, 60));
      });
      await wait(16);
    }
    await act(async () => {
      grip.dispatchEvent(pointer("pointerup", 370, 60));
    });
    await wait(50);

    expect(onReorder.mock.calls).toEqual([
      [
        {
          payload: { name: "Alpha" },
          group: "my-order",
          from: 0,
          to: 2,
          keys: ["Alpha", "Bravo"],
        },
      ],
    ]);
  });

  it("reports the pickup's slots when a row leaves the group mid-drag", async () => {
    // A row leaves the group while another is held: a tick's regroup
    // or a step. The drop keeps the pickup's slots and keys, and the
    // screen reads them against its own rows.
    const onReorder = vi.fn();
    const five = [
      { name: "Alpha", index: 0 },
      { name: "Bravo", index: 1 },
      { name: "Charlie", index: 2 },
      { name: "Delta", index: 3 },
      { name: "Echo", index: 4 },
    ];
    const place = (rows: Shown[]) =>
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
    const { rerender } = render(<Screen rows={five} count={5} onReorder={onReorder} />);
    place(five);
    const grip = screen.getByTestId("reorder-grip:Delta");

    await act(async () => {
      grip.dispatchEvent(pointer("pointerdown", 370, 156));
    });
    await wait(50);
    expect(screen.getByTestId("drag-ghost"), "the grip picked the row up").toBeTruthy();
    for (let step = 0; step < 2; step += 1) {
      await act(async () => {
        grip.dispatchEvent(pointer("pointermove", 370, 6));
      });
      await wait(16);
    }

    // Bravo left the group, and the rows below it moved up one.
    const four = [
      { name: "Alpha", index: 0 },
      { name: "Charlie", index: 1 },
      { name: "Delta", index: 2 },
      { name: "Echo", index: 3 },
    ];
    rerender(<Screen rows={four} count={4} onReorder={onReorder} />);
    place(four);

    await act(async () => {
      grip.dispatchEvent(pointer("pointerup", 370, 6));
    });
    await wait(50);

    expect(onReorder.mock.calls).toEqual([
      [
        {
          payload: { name: "Delta" },
          group: "Today",
          from: 3,
          to: 0,
          keys: ["Alpha", "Bravo", "Charlie", "Delta", "Echo"],
        },
      ],
    ]);
  });

  it("steps a row one place from the keyboard through the drop's event", async () => {
    const onReorder = vi.fn();
    render(
      <Screen
        rows={[
          { name: "Alpha", index: 0 },
          { name: "Delta", index: 3 },
          { name: "Echo", index: 4 },
        ]}
        count={5}
        onReorder={onReorder}
      />,
    );
    const key = async (name: string, value: string) => {
      screen.getByTestId(`reorder-grip:${name}`).focus();
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: value }));
      });
    };

    await key("Echo", "ArrowUp");
    expect(onReorder.mock.calls).toEqual([
      [{ payload: { name: "Echo" }, group: "Today", from: 4, to: 3, keys: [] }],
    ]);

    await key("Delta", "ArrowDown");
    expect(onReorder.mock.calls).toEqual([
      [{ payload: { name: "Echo" }, group: "Today", from: 4, to: 3, keys: [] }],
      [{ payload: { name: "Delta" }, group: "Today", from: 3, to: 5, keys: [] }],
    ]);

    onReorder.mockClear();
    await key("Echo", "ArrowDown");
    await key("Alpha", "ArrowUp");
    expect(onReorder, "the group's edges hold").not.toHaveBeenCalled();
  });
});
