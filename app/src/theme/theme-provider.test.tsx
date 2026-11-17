import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { beforeEach, describe, expect, it } from "vitest";
import { THEMES, type Palette } from "@/theme/palettes";
import { loadSettings } from "@/lib/settings";
import { ThemeProvider, useTheme, useThemedStyles } from "./theme-provider";

/** jsdom reports colors as rgb(); the palettes hold hex. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

function makeStyles(colors: Palette) {
  return {
    styles: StyleSheet.create({
      page: { backgroundColor: colors.paper },
    }),
  };
}

/** A screen with state the user typed, and a switch beside it. */
function Screen() {
  const { styles } = useThemedStyles(makeStyles);
  const { name, setTheme } = useTheme();
  const [typed, setTyped] = React.useState("");
  return (
    <View testID="page" style={styles.page}>
      <Text testID="theme-name">{name}</Text>
      <TextInput testID="field" value={typed} onChangeText={setTyped} />
      <Text testID="switch" onPress={() => setTheme("midnight")}>
        midnight
      </Text>
      <Text testID="switch-back" onPress={() => setTheme("budget")}>
        budget
      </Text>
    </View>
  );
}

function mount() {
  return render(
    <ThemeProvider>
      <Screen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});

describe("ThemeProvider", () => {
  it("repaints the same screen when the palette changes", () => {
    mount();
    const page = screen.getByTestId("page");
    expect(getComputedStyle(page).backgroundColor).toBe(rgb(THEMES.budget.paper));

    fireEvent.change(screen.getByTestId("field"), {
      target: { value: "typed before the switch" },
    });
    fireEvent.click(screen.getByTestId("switch"));

    // The same node, not a remount: the screen, its scroll and its
    // open surfaces keep their place.
    expect(screen.getByTestId("page")).toBe(page);
    expect(getComputedStyle(page).backgroundColor).toBe(
      rgb(THEMES.midnight.paper),
    );
    expect(screen.getByTestId("theme-name").textContent).toBe("midnight");
    expect(screen.getByTestId("field")).toHaveProperty(
      "value",
      "typed before the switch",
    );
  });

  it("saves the choice and reads it back on a fresh mount", () => {
    const first = mount();
    fireEvent.click(screen.getByTestId("switch"));
    expect(loadSettings().theme).toBe("midnight");
    first.unmount();

    mount();
    expect(screen.getByTestId("theme-name").textContent).toBe("midnight");
    expect(getComputedStyle(screen.getByTestId("page")).backgroundColor).toBe(
      rgb(THEMES.midnight.paper),
    );
  });

  it("builds one sheet per palette and reuses it", () => {
    let built = 0;
    const counted = (colors: Palette) => {
      built += 1;
      return {
        styles: StyleSheet.create({ page: { backgroundColor: colors.paper } }),
      };
    };
    function Counted() {
      const { styles } = useThemedStyles(counted);
      const { setTheme } = useTheme();
      return (
        <View testID="counted" style={styles.page}>
          <Text testID="to-midnight" onPress={() => setTheme("midnight")}>
            midnight
          </Text>
          <Text testID="to-budget" onPress={() => setTheme("budget")}>
            budget
          </Text>
        </View>
      );
    }
    render(
      <ThemeProvider>
        <Counted />
      </ThemeProvider>,
    );
    expect(built).toBe(1);
    fireEvent.click(screen.getByTestId("to-midnight"));
    expect(built).toBe(2);
    fireEvent.click(screen.getByTestId("to-budget"));
    expect(built).toBe(2);
  });
});
