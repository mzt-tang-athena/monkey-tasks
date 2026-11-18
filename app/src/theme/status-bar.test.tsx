import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

const styles: string[] = [];

vi.mock("expo-status-bar", () => ({
  StatusBar: ({ style }: { style: string }) => {
    styles.push(style);
    return null;
  },
}));

import { THEME_NAMES, type ThemeName } from "@/theme/palettes";
import { ThemedStatusBar } from "./status-bar";
import { ThemeProvider, useTheme } from "./theme-provider";

function Picker() {
  const { setTheme } = useTheme();
  return (
    <>
      {(Object.keys(THEME_NAMES) as ThemeName[]).map((name) => (
        <Text key={name} testID={`to-${name}`} onPress={() => setTheme(name)}>
          {name}
        </Text>
      ))}
    </>
  );
}

function mount() {
  return render(
    <ThemeProvider>
      <ThemedStatusBar />
      <Picker />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  styles.length = 0;
  globalThis.localStorage?.clear();
});

describe("ThemedStatusBar", () => {
  it("uses dark icons on every light palette", () => {
    mount();
    for (const name of ["budget", "todoist", "clay"] as ThemeName[]) {
      fireEvent.click(screen.getByTestId(`to-${name}`));
      expect(styles.at(-1)).toBe("dark");
    }
  });

  it("switches to light icons on Midnight, with no restart", () => {
    mount();
    expect(styles.at(-1)).toBe("dark");

    fireEvent.click(screen.getByTestId("to-midnight"));

    expect(styles.at(-1)).toBe("light");
  });
});
