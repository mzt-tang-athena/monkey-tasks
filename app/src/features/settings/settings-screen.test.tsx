import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Linking, Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSettings } from "@/lib/settings";
import { useSetting } from "@/lib/settings-store";
import { THEMES } from "@/theme/palettes";
import { ThemeProvider } from "@/theme/theme-provider";
import { touchTarget } from "@/theme/tokens";
import SettingsScreen from "./settings-screen";

const spy = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
}));

vi.mock("expo-router", () => ({
  router: { push: spy.push, back: spy.back },
  Stack: { Screen: () => null },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("@/lib/vault/vault-provider", () => ({
  useVault: () => ({ root: "memory://vault" }),
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.0.0" } },
}));

/** jsdom reports colors as rgb(); the palettes hold hex. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** jsdom lays out nothing, so a target's size is the floor its style
    sets: the min height and width React Native Web writes as CSS. */
function floor(element: HTMLElement) {
  const style = getComputedStyle(element);
  return {
    height: Math.max(parseFloat(style.minHeight) || 0, parseFloat(style.height) || 0),
    width: Math.max(parseFloat(style.minWidth) || 0, parseFloat(style.width) || 0),
  };
}

function mount() {
  return render(
    <ThemeProvider>
      <SettingsScreen />
    </ThemeProvider>,
  );
}

/** A second screen that only reads the setting, as Lists does. */
function Reader() {
  const [sortMode] = useSetting("sortMode");
  return <Text testID="reader">{sortMode}</Text>;
}

beforeEach(() => {
  globalThis.localStorage?.clear();
  spy.push.mockClear();
  spy.back.mockClear();
});

describe("SettingsScreen", () => {
  it("reads the palettes as a radio group with the saved one checked", () => {
    globalThis.localStorage.setItem("monkey-tasks.theme", "clay");
    mount();

    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
    expect(
      screen.getAllByRole("radio").map((radio) => [
        radio.getAttribute("aria-label"),
        radio.getAttribute("aria-checked"),
      ]),
    ).toEqual([
      ["Budget", "false"],
      ["Todoist", "false"],
      ["Clay", "true"],
      ["Midnight", "false"],
    ]);

    for (const radio of screen.getAllByRole("radio")) {
      const size = floor(radio);
      expect(size.height).toBeGreaterThanOrEqual(touchTarget);
      expect(size.width).toBeGreaterThanOrEqual(touchTarget);
    }
  });

  it("repaints in place when a radio picks a palette", () => {
    mount();
    const page = screen.getByTestId("settings-screen");
    expect(getComputedStyle(page).backgroundColor).toBe(rgb(THEMES.budget.paper));

    fireEvent.click(screen.getByRole("radio", { name: "Midnight" }));

    expect(
      screen.getByRole("radio", { name: "Midnight" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("radio", { name: "Budget" }).getAttribute("aria-checked"),
    ).toBe("false");
    expect(globalThis.localStorage.getItem("monkey-tasks.theme")).toBe("midnight");
    // The same node: the screen repainted, it did not remount.
    expect(screen.getByTestId("settings-screen")).toBe(page);
    expect(getComputedStyle(page).backgroundColor).toBe(rgb(THEMES.midnight.paper));
  });

  it("saves the sort order and the task form, and reads them back", () => {
    const first = mount();
    expect(
      screen.getByRole("tab", { name: "Due date" }).getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "My order" }));
    fireEvent.click(screen.getByRole("tab", { name: "Chips" }));

    expect(loadSettings().sortMode).toBe("manual");
    expect(loadSettings().taskForm).toBe("pills");
    expect(globalThis.localStorage.getItem("monkey-tasks.sort-mode")).toBe("manual");
    expect(globalThis.localStorage.getItem("monkey-tasks.task-form")).toBe("pills");
    first.unmount();

    mount();
    expect(
      screen.getByRole("tab", { name: "My order" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("tab", { name: "Chips" }).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("updates another mounted screen when a setting changes", () => {
    render(
      <ThemeProvider>
        <SettingsScreen />
        <Reader />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("reader").textContent).toBe("due");

    fireEvent.click(screen.getByRole("tab", { name: "My order" }));

    expect(screen.getByTestId("reader").textContent).toBe("manual");
  });

  it("opens diagnostics and the repository from their rows", () => {
    const open = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Open diagnostics" }));
    fireEvent.click(screen.getByRole("link", { name: "Repository" }));

    expect(spy.push).toHaveBeenCalledWith("/dev");
    expect(open).toHaveBeenCalledWith(
      "https://github.com/mzt-tang-athena/monkey-tasks",
    );
  });

  it("states the app facts without reading a vault note", () => {
    mount();

    expect(screen.getByText("1.0.0")).toBeTruthy();
    expect(screen.getByText("development")).toBeTruthy();
    expect(screen.getByText("memory://vault")).toBeTruthy();
    expect(
      screen.getByText("https://github.com/mzt-tang-athena/monkey-tasks"),
    ).toBeTruthy();
  });

  it("goes back from the header", () => {
    mount();

    fireEvent.click(screen.getByRole("button", { name: "back" }));

    expect(spy.back).toHaveBeenCalledTimes(1);
  });
});
