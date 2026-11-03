import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackHandler, Platform, Text } from "react-native";
import type { CaptureTarget, ParsedCapture } from "@/types/task";
import { BottomBar } from "@/components/bottom-bar/bottom-bar";
import { OverlayHost } from "@/components/ui/overlay-host";
import { CaptureDock } from "./capture-dock";

// The dock reads the route, the safe area, the keyboard and the capture
// mutation. The test owns each of them.

const state = vi.hoisted(() => ({
  capture: vi.fn(),
  navigate: vi.fn(),
  focused: true,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("expo-router", () => ({
  router: { navigate: state.navigate, back: vi.fn() },
  usePathname: () => "/",
  useIsFocused: () => state.focused,
}));

vi.mock("react-native-keyboard-controller", async () => {
  const { Animated } = await import("react-native");
  const height = new Animated.Value(0);
  return { useKeyboardAnimation: () => ({ height, progress: height }) };
});

vi.mock("@/stores/tasks/mutations/use-capture-task", () => ({
  useCaptureTask: () => state.capture,
}));

const targets: CaptureTarget[] = [{ kind: "main" }, { kind: "list", name: "Work" }];

function Screen() {
  return (
    <OverlayHost>
      <Text>screen content</Text>
      <BottomBar
        action={
          <CaptureDock
            targets={targets}
            defaultTargetIndex={1}
            dueDay="2026-10-27"
          />
        }
      />
    </OverlayHost>
  );
}

/** The sheet's exit plays on the clock; run it out. */
function finishMotion() {
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function openSheet() {
  fireEvent.click(screen.getByRole("button", { name: "add task" }));
}

function type(text: string) {
  fireEvent.change(screen.getByPlaceholderText("Add a task"), {
    target: { value: text },
  });
}

describe("CaptureDock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.capture.mockReset();
    state.capture.mockResolvedValue(undefined);
    state.focused = true;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens a named dialog from the Add button", () => {
    render(<Screen />);
    expect(screen.queryByRole("dialog")).toBeNull();

    openSheet();

    expect(screen.getByRole("dialog", { name: "Add a task" })).toBeTruthy();
  });

  it("hides the screen content from assistive tech while the sheet shows", () => {
    render(<Screen />);
    openSheet();

    expect(
      screen.getByText("screen content").closest('[aria-hidden="true"]'),
    ).not.toBeNull();
    expect(screen.getByRole("dialog").closest('[aria-hidden="true"]')).toBeNull();
  });

  it("names the target pill with its current target", () => {
    render(<Screen />);
    openSheet();

    const pill = screen.getByRole("button", { name: "target list: Work" });
    fireEvent.click(pill);

    expect(screen.getByRole("button", { name: "target list: Main" })).toBeTruthy();
  });

  it("closes on a press on the scrim", () => {
    render(<Screen />);
    openSheet();

    fireEvent.click(screen.getByRole("button", { name: "close capture" }));
    finishMotion();

    expect(screen.queryByRole("dialog")).toBeNull();
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
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterEach(() => {
      (Platform as { OS: string }).OS = os;
      vi.restoreAllMocks();
    });

    it("closes on the back button, and the screen stays", () => {
      render(<Screen />);
      openSheet();

      let handled: boolean | null | undefined;
      act(() => {
        handled = back?.(undefined as never);
      });
      finishMotion();

      // The press is taken, so the router never sees it.
      expect(handled).toBe(true);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByText("screen content")).toBeTruthy();
    });

    it("lets the back button through while the sheet is shut", () => {
      render(<Screen />);

      expect(back).toBeNull();
    });
  });

  it("sends the draft to the target and the due day, then closes", async () => {
    render(<Screen />);
    openSheet();
    type("Buy milk");

    fireEvent.click(screen.getByRole("button", { name: "send task" }));
    await flush();
    finishMotion();

    expect(state.capture).toHaveBeenCalledTimes(1);
    const [parsed, target, due] = state.capture.mock.calls[0] as [
      ParsedCapture,
      CaptureTarget,
      string,
    ];
    expect(parsed.name).toBe("Buy milk");
    expect(target).toEqual({ kind: "list", name: "Work" });
    expect(due).toBe("2026-10-27");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports a failed write in a toast, and Retry sends the same draft", async () => {
    state.capture.mockRejectedValueOnce(new Error("create failed: Buy milk.md"));
    render(<Screen />);
    openSheet();
    type("Buy milk");

    fireEvent.click(screen.getByRole("button", { name: "send task" }));
    await flush();
    finishMotion();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      "create failed: Buy milk.md",
    );

    fireEvent.click(screen.getByRole("button", { name: "retry capture" }));
    await flush();

    expect(state.capture).toHaveBeenCalledTimes(2);
    expect(state.capture.mock.calls[1]).toEqual(state.capture.mock.calls[0]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("draws the toast only while its tab is focused", async () => {
    state.capture.mockRejectedValueOnce(new Error("create failed: Buy milk.md"));
    const view = render(<Screen />);
    openSheet();
    type("Buy milk");
    fireEvent.click(screen.getByRole("button", { name: "send task" }));
    await flush();
    finishMotion();
    expect(screen.getByRole("alert")).toBeTruthy();

    // Another screen takes focus: the toast leaves, the draft stays.
    state.focused = false;
    view.rerender(<Screen />);
    expect(screen.queryByRole("alert")).toBeNull();

    state.focused = true;
    view.rerender(<Screen />);
    expect(screen.getByRole("alert").textContent).toContain(
      "create failed: Buy milk.md",
    );
  });

  it("dismisses the toast", async () => {
    state.capture.mockRejectedValueOnce(new Error("create failed: Buy milk.md"));
    render(<Screen />);
    openSheet();
    type("Buy milk");
    fireEvent.click(screen.getByRole("button", { name: "send task" }));
    await flush();
    finishMotion();

    fireEvent.click(
      screen.getByRole("button", { name: "dismiss capture failure" }),
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
