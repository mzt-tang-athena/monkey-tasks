import { expect, type Page } from "@playwright/test";
import type { ThemeName } from "../src/theme/palettes";

/** jsdom and the browser report colors as rgb(); the palettes hold hex. */
export function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Switch the running palette through the provider's own setter. The
 * exported web build exposes it as `globalThis.__setTheme` when it is
 * made with `EXPO_PUBLIC_VAULT_TEST_HOOKS=1`, as `npm run web:export`
 * does.
 */
export async function setTheme(page: Page, name: ThemeName) {
  // The provider installs the hook on its first effect.
  await expect
    .poll(() =>
      page.evaluate(() => typeof (globalThis as { __setTheme?: unknown }).__setTheme),
    )
    .toBe("function");
  await page.evaluate((theme) => {
    const set = (globalThis as { __setTheme?: (next: string) => void }).__setTheme;
    if (set == null) {
      throw new Error("the build has no theme test hook: run npm run web:export");
    }
    set(theme);
  }, name);
}
