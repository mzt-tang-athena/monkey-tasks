import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackHandler, Platform, Text, TextInput } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useProgress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { spacing } from "@/theme/tokens";
import { OverlayHost } from "./overlay-host";
import { Sheet } from "./sheet";

// The sheet rides the keyboard's shared values. The test moves them.
const keyboard = vi.hoisted(() => ({
  height: { value: 0 },
  progress: { value: 0 },
}));
vi.mock("react-native-keyboard-controller", async () => {
  const { makeMutable } = await import("react-native-reanimated");
  const height = makeMutable(0);
  const progress = makeMutable(0);
  keyboard.height = height;
  keyboard.progress = progress;
  return {
    useReanimatedKeyboardAnimation: () => ({ height, progress }),
  };
});

// The device reports its system insets. The test gives them a value a
// phone with three-button navigation reports.
const safe = vi.hoisted(() => ({ bottom: 0 }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    right: 0,
    bottom: safe.bottom,
    left: 0,
  }),
}));

function Harness({
  initial = true,
  rideKeyboard = false,
}: {
  initial?: boolean;
  rideKeyboard?: boolean;
}) {
  const [open, setOpen] = React.useState(initial);
  const [mounted, setMounted] = React.useState(initial);
  const progress = useProgress(open, {
    ms: motion.ms.sheet,
    onSettled: (at) => {
      if (at === 0) {
        setMounted(false);
      }
    },
  });
  const openSheet = () => {
    setMounted(true);
    setOpen(true);
  };
  // The app's root wraps every screen in the gesture root, and the
  // sheet's handle needs it on a phone.
  return (
    <GestureHandlerRootView>
      <OverlayHost>
        <Text>screen content</Text>
        <Text onPress={openSheet} accessibilityRole="button">
          open
        </Text>
        {mounted ? (
          <Sheet
            open={open}
            progress={progress}
            onDismiss={() => setOpen(false)}
            label="Add a task"
            closeLabel="close capture"
            rideKeyboard={rideKeyboard}
            scrim
          >
            <TextInput placeholder="Add a task" />
          </Sheet>
        ) : null}
      </OverlayHost>
    </GestureHandlerRootView>
  );
}

/** The sheet's exit plays on the clock; run it out. */
async function finishMotion() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 320)));
}

/** An ancestor carries `inert`. */
function inert(element: HTMLElement): boolean {
  let node: HTMLElement | null = element;
  while (node != null) {
    if (node.hasAttribute("inert")) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

describe("Sheet", () => {
  afterEach(() => {
    safe.bottom = 0;
    keyboard.height.value = 0;
    keyboard.progress.value = 0;
  });

  it("reports a named modal dialog", () => {
    render(<Harness />);

    const dialog = screen.getByRole("dialog", { name: "Add a task" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByPlaceholderText("Add a task")).toBeTruthy();
  });

  it("keeps the drag handle out of the accessibility tree", () => {
    render(<Harness />);

    const handle = screen.getByTestId("sheet-handle");
    expect(handle.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "close capture" })).toBeTruthy();
  });

  it("makes the screen inert while it shows", () => {
    render(<Harness />);

    expect(inert(screen.getByText("screen content"))).toBe(true);
    expect(inert(screen.getByRole("dialog"))).toBe(false);
  });

  it("moves focus into the sheet and back to the opener on close", async () => {
    render(<Harness initial={false} />);
    const opener = screen.getByText("open");
    opener.focus();

    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Add a task" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "close capture" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("closes on a press on the scrim, and leaves once its exit has played", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "close capture" }));
    await finishMotion();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "close capture" })).toBeNull();
    expect(screen.getByText("screen content").closest('[aria-hidden="true"]')).toBeNull();
  });

  it("closes on Escape in the browser", async () => {
    render(<Harness />);

    fireEvent.keyDown(document, { key: "Escape" });
    await finishMotion();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the panel's 8pt gap above the bottom inset", () => {
    safe.bottom = 48;
    render(<Harness />);

    const dock = screen.getByTestId("sheet-dock");
    expect(parseFloat(getComputedStyle(dock).bottom)).toBe(spacing.s + 48);
  });

  it("lifts the panel by the keyboard above the inset, for an 8pt gap", async () => {
    safe.bottom = 48;
    render(<Harness rideKeyboard />);
    await act(async () => {
      // The library reports a negative height, a translate that clears
      // the keyboard.
      keyboard.height.value = -300;
      keyboard.progress.value = 1;
      await new Promise<void>((resolve) => setTimeout(resolve, 32));
    });

    // The panel's bottom sits the dock's gap plus the lift above the
    // window. The keyboard is 300 tall, so 8 of gap leaves 300 - 48 of
    // travel once the dock has cleared the 48pt inset.
    const dock = screen.getByTestId("sheet-dock");
    const lift = dock.parentElement as HTMLElement;
    expect(parseFloat(getComputedStyle(dock).bottom)).toBe(spacing.s + 48);
    expect(getComputedStyle(lift).transform).toContain("-252px");
  });

  it("is not drawn while closed", async () => {
    render(<Harness initial={false} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await finishMotion();
  });

  describe("on Android", () => {
    const os = Platform.OS;
    let back: ((event: never) => boolean | null | undefined) | null = null;

    beforeEach(() => {
      (Platform as { OS: string }).OS = "android";
      vi.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
        back = handler;
        return { remove: () => (back = null) };
      });
    });
    afterEach(() => {
      (Platform as { OS: string }).OS = os;
    });

    it("closes on the back button and takes the press", async () => {
      render(<Harness />);

      let handled: boolean | null | undefined;
      act(() => {
        handled = back?.(undefined as never);
      });
      await finishMotion();

      expect(handled).toBe(true);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
