import type { ThemeName } from "@/theme/tokens";

/**
 * A switch for the end-to-end suite. The web build has it only when
 * it is made with `EXPO_PUBLIC_VAULT_TEST_HOOKS=1`, as `npm run
 * web:export` does. A release APK has neither. Expo inlines the
 * variable at build time, so it must be read by its full name.
 */
export function themeTestHooksOn(
  dev: boolean = typeof __DEV__ !== "undefined" && __DEV__,
  flag: string | undefined = process.env.EXPO_PUBLIC_VAULT_TEST_HOOKS,
): boolean {
  return dev || flag === "1";
}

declare global {
  var __setTheme: ((name: ThemeName) => void) | undefined;
}

/** Put the provider's setter on `globalThis.__setTheme`. */
export function installThemeTestHooks(
  setTheme: (name: ThemeName) => void,
): () => void {
  if (!themeTestHooksOn()) {
    return () => {};
  }
  globalThis.__setTheme = setTheme;
  return () => {
    if (globalThis.__setTheme === setTheme) {
      globalThis.__setTheme = undefined;
    }
  };
}
