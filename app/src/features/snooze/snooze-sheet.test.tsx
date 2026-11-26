import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverlayHost } from "@/components/ui/overlay-host";
import {
  clearSnoozeRequest,
  requestSnooze,
} from "@/lib/alerts/snooze-request";
import { SnoozeHost } from "./snooze-sheet";

// The sheet behind the Snooze button. The press, the route and the
// alarm list belong to other tests, so this one owns them as spies.

const spy = vi.hoisted(() => ({
  press: vi.fn(async (_adapter: unknown, _press: unknown) => null),
  open: vi.fn(),
  acknowledge: vi.fn(async (_ring: unknown) => undefined),
  invalidate: vi.fn(async () => undefined),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("react-native-keyboard-controller", async () => {
  const { useSharedValue } = await import("react-native-reanimated");
  return {
    useReanimatedKeyboardAnimation: () => ({
      height: useSharedValue(0),
      progress: useSharedValue(0),
    }),
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: spy.invalidate }),
}));

vi.mock("@/lib/vault/default-adapter", () => ({
  defaultAdapter: () => "adapter",
}));

vi.mock("@/stores/tasks/alert-actions", () => ({
  performAlertPress: spy.press,
}));

vi.mock("@/stores/tasks/reminder-sync", () => ({
  acknowledgeRing: spy.acknowledge,
}));

vi.mock("@/lib/task-route", () => ({ openTask: spy.open }));

const NOW = new Date(2026, 10, 26, 10, 1, 0);
const request = {
  uri: "content://vault/Tasks/Call Mum.md",
  base: 1234,
  name: "Call Mum",
  key: "alert:x|snooze",
};

async function finishMotion() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 320)));
}

async function shows() {
  render(
    <OverlayHost>
      <SnoozeHost />
    </OverlayHost>,
  );
  await act(async () => {
    requestSnooze(request);
  });
  await finishMotion();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  act(() => clearSnoozeRequest());
});

describe("the Snooze sheet", () => {
  it("shows nothing until Snooze is pressed", () => {
    render(
      <OverlayHost>
        <SnoozeHost />
      </OverlayHost>,
    );
    expect(screen.queryByRole("button", { name: "Later" })).toBeNull();
  });

  it("offers Later, Tomorrow and Pick a day, under the task's name", async () => {
    await shows();

    for (const name of ["Later", "Tomorrow", "Pick a day"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByText("Call Mum")).toBeTruthy();
  });

  it("Later reschedules an hour on, rounded up to five minutes, and closes", async () => {
    await shows();

    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    await finishMotion();

    expect(spy.press).toHaveBeenCalledTimes(1);
    expect(spy.press).toHaveBeenCalledWith("adapter", {
      uri: request.uri,
      base: 1234,
      action: { kind: "reschedule", target: "2026-11-26T11:05" },
      name: "Call Mum",
      key: "alert:x|snooze|later",
    });
    expect(spy.open).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Later" })).toBeNull();
  });

  it("Tomorrow reschedules to nine tomorrow morning", async () => {
    await shows();

    fireEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

    expect(spy.press).toHaveBeenCalledWith(
      "adapter",
      expect.objectContaining({
        action: { kind: "reschedule", target: "2026-11-27T09:00" },
        key: "alert:x|snooze|tomorrow",
      }),
    );
  });

  it("Pick a day opens the task on its Due picker and clears the reminder", async () => {
    await shows();

    fireEvent.click(screen.getByRole("button", { name: "Pick a day" }));

    expect(spy.open).toHaveBeenCalledWith(request.uri, { picker: "due" });
    expect(spy.acknowledge).toHaveBeenCalledWith({
      uri: request.uri,
      base: 1234,
    });
    expect(spy.press).not.toHaveBeenCalled();
  });

  it("writes nothing and keeps the reminder when the sheet is closed", async () => {
    await shows();

    fireEvent.click(screen.getByRole("button", { name: "close snooze" }));
    await finishMotion();

    expect(spy.press).not.toHaveBeenCalled();
    expect(spy.open).not.toHaveBeenCalled();
    expect(spy.acknowledge).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Later" })).toBeNull();
  });
});
