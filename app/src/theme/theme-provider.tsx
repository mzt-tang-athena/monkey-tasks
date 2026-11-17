import * as React from "react";
import { loadSettings, saveSetting } from "@/lib/settings";
import { THEMES, type Palette, type ThemeName } from "@/theme/tokens";
import { installThemeTestHooks } from "@/theme/test-hooks";

/** The active palette, its name, and the one way to change it. */
type ThemeValue = {
  name: ThemeName;
  colors: Palette;
  setTheme: (name: ThemeName) => void;
};

/**
 * The fallback keeps a component renderable on its own, as a unit test
 * does. The app mounts one provider, above every screen and the
 * overlay host, so the fallback is never the running palette.
 */
const ThemeContext = React.createContext<ThemeValue>({
  name: "budget",
  colors: THEMES.budget,
  setTheme: () => {},
});

/**
 * One owner of the active theme. It starts from the saved setting and
 * saves every change, so a restart opens on the same palette.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = React.useState<ThemeName>(
    () => loadSettings().theme,
  );
  const setTheme = React.useCallback((next: ThemeName) => {
    setName(next);
    saveSetting("theme", next);
  }, []);

  React.useEffect(() => installThemeTestHooks(setTheme), [setTheme]);

  const value = React.useMemo<ThemeValue>(
    () => ({ name, colors: THEMES[name], setTheme }),
    [name, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return React.useContext(ThemeContext);
}

/** One theme's sheets for one factory. A switch back is a lookup. */
const sheets = new WeakMap<
  (colors: Palette) => Record<string, unknown>,
  Map<ThemeName, Record<string, unknown>>
>();

/**
 * Build the style sheets for the active palette. A component keeps its
 * sheet declarations in `makeStyles` and reads them here, so a theme
 * change repaints it without a remount. The palette rides along for
 * the few props that take a color, such as a placeholder.
 */
export function useThemedStyles<T extends Record<string, unknown>>(
  makeStyles: (colors: Palette) => T,
): T & { colors: Palette } {
  const { name, colors } = useTheme();
  return React.useMemo(() => {
    let byTheme = sheets.get(makeStyles);
    if (byTheme == null) {
      byTheme = new Map();
      sheets.set(makeStyles, byTheme);
    }
    let made = byTheme.get(name);
    if (made == null) {
      made = makeStyles(colors);
      byTheme.set(name, made);
    }
    return { ...made, colors } as T & { colors: Palette };
  }, [makeStyles, name, colors]);
}
