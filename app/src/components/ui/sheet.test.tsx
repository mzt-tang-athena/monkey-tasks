import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackHandler, Platform, Text, TextInput } from "react-native";
import { OverlayHost } from "./overlay-host";
import { Sheet } from "./sheet";

// The sheet rides the keyboard's height. The test has no keyboard.
vi.mock("react-native-keyboard-controller", async () => {
  const { Animated } = await import("react-native");
  const height = new Animated.Value(0);
  return { useKeyboardAnimation: () => ({ height, progress: height }) };
});

function Harness({ initial = true }: { initial?: boolean }) {
  const [open, setOpen] = React.useState(initial);
  return (
    <OverlayHost>
      <Text>screen content</Text>
      <Text onPress={() => setOpen(true)}>open</Text>
      <Sheet open={open} onClose={() => setOpen(false)} label="Add a task" closeLabel="close capture">
        <TextInput placeholder="Add a task" />
      </Sheet>
    </OverlayHost>
  );
}

/** The sheet's exit plays on the clock; run it out. */
function finishMotion() {
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

describe("Sheet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("closes on a press on the scrim, and leaves once its exit has played", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "close capture" }));
    finishMotion();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("screen content").closest('[aria-hidden="true"]')).toBeNull();
  });

  it("closes on Escape in the browser", () => {
    render(<Harness />);

    fireEvent.keyDown(document, { key: "Escape" });
    finishMotion();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is not drawn while closed", () => {
    render(<Harness initial={false} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByRole("dialog")).toBeTruthy();
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
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterEach(() => {
      (Platform as { OS: string }).OS = os;
      vi.restoreAllMocks();
    });

    it("closes on the back button and takes the press", () => {
      render(<Harness />);

      let handled: boolean | null | undefined;
      act(() => {
        handled = back?.(undefined as never);
      });
      finishMotion();

      expect(handled).toBe(true);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
