import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackHandler, Platform, Text, TextInput } from "react-native";
import { useProgress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { OverlayHost } from "./overlay-host";
import { Sheet } from "./sheet";

// The sheet rides the keyboard's shared values. The test has no keyboard.
vi.mock("react-native-keyboard-controller", async () => {
  const { useSharedValue } = await import("react-native-reanimated");
  return {
    useReanimatedKeyboardAnimation: () => ({
      height: useSharedValue(0),
      progress: useSharedValue(0),
    }),
  };
});

function Harness({ initial = true }: { initial?: boolean }) {
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
  return (
    <OverlayHost>
      <Text>screen content</Text>
      <Text onPress={openSheet}>open</Text>
      {mounted ? (
        <Sheet
          open={open}
          progress={progress}
          onDismiss={() => setOpen(false)}
          label="Add a task"
          closeLabel="close capture"
          scrim
        >
          <TextInput placeholder="Add a task" />
        </Sheet>
      ) : null}
    </OverlayHost>
  );
}

/** The sheet's exit plays on the clock; run it out. */
async function finishMotion() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 320)));
}

describe("Sheet", () => {
  it("reports a named modal dialog", () => {
    render(<Harness />);

    const dialog = screen.getByRole("dialog", { name: "Add a task" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByPlaceholderText("Add a task")).toBeTruthy();
  });

  it("hides the screen content from assistive tech while it shows", () => {
    render(<Harness />);

    expect(screen.getByText("screen content").closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole("dialog").closest('[aria-hidden="true"]')).toBeNull();
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
