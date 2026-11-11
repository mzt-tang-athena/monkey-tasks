import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.0.0" } },
}));

import { ErrorBoundary } from "./error-boundary";
import { crashCount, readCrashLog } from "@/lib/crash-log";
import { ThemeProvider } from "@/theme/theme-provider";

function Boom(): React.ReactElement {
  throw new Error("render boom");
}

function mount(label?: string) {
  return render(
    <ThemeProvider>
      <ErrorBoundary label={label}>
        <Boom />
      </ErrorBoundary>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});

describe("ErrorBoundary", () => {
  it("writes its caught render error with the screen label", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    mount("Settings");

    expect(screen.getByText("Settings hit a problem")).toBeTruthy();
    const text = readCrashLog();
    expect(crashCount(text)).toBe(1);
    expect(text).toContain("kind=render label=Settings");
    expect(text).toContain("message: render boom");
    expect(text).toContain("app=1.0.0");

    logged.mockRestore();
  });

  it("names the app when the boundary carries no label", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    mount();

    expect(screen.getByText("Something broke")).toBeTruthy();
    expect(readCrashLog()).toContain("kind=render label=app");

    logged.mockRestore();
  });

  it("keeps the panel and clears the error on retry", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    let broken = true;

    function Flaky(): React.ReactElement {
      if (broken) {
        throw new Error("flaky");
      }
      return <Text>Recovered</Text>;
    }

    render(
      <ThemeProvider>
        <ErrorBoundary label="Settings">
          <Flaky />
        </ErrorBoundary>
      </ThemeProvider>,
    );

    expect(screen.getByText("Settings hit a problem")).toBeTruthy();
    broken = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Recovered")).toBeTruthy();

    logged.mockRestore();
  });
});
