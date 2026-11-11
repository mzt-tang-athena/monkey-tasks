import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Share } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clipboard = vi.hoisted(() => ({
  setStringAsync: vi.fn(async () => undefined),
}));

vi.mock("expo-clipboard", () => clipboard);
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.0.0" } },
}));

import { CrashLogCard } from "./crash-log-card";
import { readCrashLog, reportCrash } from "@/lib/crash-log";
import { ThemeProvider } from "@/theme/theme-provider";

const AT = new Date("2026-11-11T10:00:00.000Z");

function mount() {
  return render(
    <ThemeProvider>
      <CrashLogCard />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  globalThis.localStorage?.clear();
  clipboard.setStringAsync.mockClear();
  vi.restoreAllMocks();
});

describe("CrashLogCard", () => {
  it("reads the newest crash from the log", () => {
    reportCrash({ message: "first", stack: "Error: first", at: AT });
    reportCrash({ message: "second", stack: "Error: second", at: AT });

    mount();

    expect(screen.getByTestId("crash-log-summary").textContent).toContain("2 crashes");
    const entry = screen.getByTestId("crash-log-entry").textContent ?? "";
    expect(entry).toContain("message: second");
    expect(entry).toContain("kind=js");
    expect(entry).not.toContain("message: first");
  });

  it("says so when no crash was recorded and disables both actions", () => {
    mount();

    expect(screen.getByText("No crashes recorded.")).toBeTruthy();
    for (const name of ["Copy crash log", "Share crash log"]) {
      expect(
        screen.getByRole("button", { name }).getAttribute("aria-disabled"),
      ).toBe("true");
    }
  });

  it("copies the whole file, not the preview", async () => {
    reportCrash({ message: "first", stack: "Error: first", at: AT });
    reportCrash({ message: "second", stack: "Error: second", at: AT });
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Copy crash log" }));

    await vi.waitFor(() =>
      expect(clipboard.setStringAsync).toHaveBeenCalledWith(readCrashLog()),
    );
    expect(readCrashLog()).toContain("message: first");
    expect(await screen.findByText("Copied the crash log.")).toBeTruthy();
  });

  it("sends the whole file to the share sheet", async () => {
    const share = vi.spyOn(Share, "share").mockResolvedValue({
      action: Share.sharedAction,
      activityType: undefined,
    });
    reportCrash({ message: "boom", stack: "Error: boom", at: AT });
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Share crash log" }));

    await vi.waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "monkey-tasks crash log",
        message: readCrashLog(),
      }),
    );
    expect(await screen.findByText("Shared the crash log.")).toBeTruthy();
  });
});
