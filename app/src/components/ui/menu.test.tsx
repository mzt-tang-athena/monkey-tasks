import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackHandler, Platform, View } from "react-native";
import { placeBox, setWindowSize } from "@/testing/layout";
import { menuWidth, pageGutter } from "@/theme/tokens";
import { Menu, placeMenu, type MenuItem } from "./menu";
import { OverlayHost } from "./overlay-host";

// The safe area package reaches into React Native's Flow source, which
// node cannot load. The menu only reads the insets.
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const window = { width: 390, height: 800 };

function setWindow(width: number, height: number) {
  setWindowSize(width, height);
}

function placeAnchor(box: { x: number; y: number; width: number; height: number }) {
  placeBox(screen.getByTestId("anchor"), box);
}

function Harness({
  items,
  align,
  onClose = () => undefined,
}: {
  items: MenuItem[];
  align?: "start" | "end";
  onClose?: () => void;
}) {
  const anchor = React.useRef<React.ComponentRef<typeof View>>(null);
  const [open, setOpen] = React.useState(false);
  return (
    <OverlayHost>
        <View testID="anchor" ref={anchor} />
        <View testID="screen" />
        <button type="button" onClick={() => setOpen(true)}>
          open
        </button>
        <Menu
          open={open}
          anchor={anchor}
          label="List actions"
          align={align}
          items={items}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
    </OverlayHost>
  );
}

const items: MenuItem[] = [
  { key: "rename", label: "Rename list", onPress: vi.fn() },
  { key: "delete", label: "Delete list", tone: "danger", onPress: vi.fn() },
];

async function openMenu() {
  fireEvent.click(screen.getByText("open"));
  return waitFor(() => screen.getByRole("menu", { name: "List actions" }));
}

/** The menu's placed box, read from its inline position. */
function menuBox(menu: HTMLElement) {
  const style = menu.style;
  return { top: parseFloat(style.top), left: parseFloat(style.left) };
}

describe("Menu", () => {
  beforeEach(() => {
    setWindow(window.width, window.height);
  });

  it("opens below its anchor with the menu and item roles", async () => {
    render(<Harness items={items} />);
    placeAnchor({ x: 326, y: 20, width: 44, height: 44 });

    const menu = await openMenu();

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Rename list",
      "Delete list",
    ]);
    expect(menuBox(menu).top).toBeGreaterThan(64);
  });

  it("flips above an anchor near the bottom edge and stays inside the window", async () => {
    render(<Harness items={items} />);
    placeAnchor({ x: 20, y: 700, width: 120, height: 32 });

    const menu = await openMenu();

    const { top } = menuBox(menu);
    expect(top + items.length * 40).toBeLessThanOrEqual(700);
    expect(top).toBeGreaterThanOrEqual(0);
  });

  it("keeps its right side inside the page gutter from an anchor at the right edge", async () => {
    render(<Harness items={items} align="start" />);
    placeAnchor({ x: 370, y: 20, width: 20, height: 20 });

    const menu = await openMenu();

    const { left } = menuBox(menu);
    expect(left + menuWidth).toBeLessThanOrEqual(window.width - pageGutter);
    expect(left).toBeGreaterThanOrEqual(pageGutter);
  });

  it("measures its anchor again when the window changes size", async () => {
    render(<Harness items={items} />);
    placeAnchor({ x: 326, y: 20, width: 44, height: 44 });
    const menu = await openMenu();
    const before = menuBox(menu).left;

    placeAnchor({ x: 676, y: 20, width: 44, height: 44 });
    setWindow(740, 800);

    await waitFor(() => expect(menuBox(screen.getByRole("menu")).left).not.toBe(before));
    expect(menuBox(screen.getByRole("menu")).left).toBe(676 + 44 - menuWidth);
  });

  it("closes on a press on the backdrop", async () => {
    render(<Harness items={items} />);
    placeAnchor({ x: 326, y: 20, width: 44, height: 44 });
    await openMenu();

    fireEvent.click(screen.getByRole("button", { name: "close menu" }));

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on Escape in the browser", async () => {
    render(<Harness items={items} />);
    placeAnchor({ x: 326, y: 20, width: 44, height: 44 });
    await openMenu();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
  });

  describe("on Android", () => {
    const os = Platform.OS;
    let back: ((event: never) => boolean | null | undefined) | null = null;

    beforeEach(() => {
      (Platform as { OS: string }).OS = "android";
      vi.spyOn(BackHandler, "addEventListener").mockImplementation(
        (_event, handler) => {
          back = handler;
          return { remove: () => (back = null) };
        },
      );
      // React Native Web has no native animation module, and says so
      // once when a native driver is asked for.
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterEach(() => {
      (Platform as { OS: string }).OS = os;
      vi.restoreAllMocks();
    });

    it("closes on the back button and takes the press", async () => {
      const onClose = vi.fn();
      render(<Harness items={items} onClose={onClose} />);
      placeAnchor({ x: 326, y: 20, width: 44, height: 44 });
      await openMenu();

      let handled: boolean | null | undefined;
      act(() => {
        handled = back?.(undefined as never);
      });

      expect(handled).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it("ignores a press on a disabled item and reports aria-disabled", async () => {
    const onPress = vi.fn();
    render(
      <Harness
        items={[{ key: "clear", label: "Clear completed", disabled: true, onPress }]}
      />,
    );
    placeAnchor({ x: 326, y: 20, width: 44, height: 44 });
    await openMenu();

    const item = screen.getByRole("menuitem", { name: "Clear completed" });
    fireEvent.click(item);

    expect(onPress).not.toHaveBeenCalled();
    expect(item.getAttribute("aria-disabled")).toBe("true");
  });

  it("checks the selected item and shows its hint", async () => {
    render(
      <Harness
        items={[
          { key: "due", label: "Due date", hint: "Soonest first", selected: false, onPress: vi.fn() },
          { key: "manual", label: "My order", hint: "Drag rows to sort", selected: true, onPress: vi.fn() },
        ]}
      />,
    );
    placeAnchor({ x: 326, y: 20, width: 44, height: 44 });
    await openMenu();

    const chosen = screen.getByRole("menuitem", { name: "My order" });
    expect(chosen.getAttribute("aria-checked")).toBe("true");
    expect(chosen.textContent).toContain("Drag rows to sort");
    expect(
      screen.getByRole("menuitem", { name: "Due date" }).getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("hides the screen from assistive tech while it shows", async () => {
    render(<Harness items={items} />);
    placeAnchor({ x: 326, y: 20, width: 44, height: 44 });
    expect(screen.getByTestId("screen").closest("[aria-hidden]")).toBeNull();

    await openMenu();

    expect(screen.getByTestId("screen").closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole("menu").closest('[aria-hidden="true"]')).toBeNull();
  });
});

describe("placeMenu", () => {
  const size = { width: menuWidth, height: 88 };
  const insets = { top: 24, bottom: 16 };

  it("flips above when the menu would cross the bottom bar", () => {
    // The bar takes 68 px above the 16 px safe area: the floor is 716.
    const place = placeMenu({
      anchor: { x: 20, y: 620, width: 100, height: 20 },
      size,
      window,
      insets,
      align: "start",
    });

    expect(place.above).toBe(true);
    expect(place.top).toBe(620 - 4 - 88);
  });

  it("stays below when there is no room above either", () => {
    const place = placeMenu({
      anchor: { x: 20, y: 40, width: 100, height: 700 },
      size,
      window,
      insets,
      align: "start",
    });

    expect(place.above).toBe(false);
  });

  it("clamps the left side to the page gutter", () => {
    const place = placeMenu({
      anchor: { x: 0, y: 40, width: 30, height: 30 },
      size,
      window,
      insets,
      align: "end",
    });

    expect(place.left).toBe(pageGutter);
  });
});
