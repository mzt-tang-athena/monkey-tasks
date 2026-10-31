import type { Page } from "@playwright/test";

/**
 * The page's memory vault, through `globalThis.__vault` (ticket 0051).
 * The web build has the hooks only when it is made with
 * `EXPO_PUBLIC_VAULT_TEST_HOOKS=1`, as `npm run web:export` does.
 */

const NO_HOOKS =
  "the web build has no vault test hooks: build it with npm run web:export";

/** The text of a note, by its path under the vault, or null. */
export function noteText(page: Page, path: string): Promise<string | null> {
  return page.evaluate(
    ({ path, missing }) => {
      if (globalThis.__vault == null) {
        throw new Error(missing);
      }
      return globalThis.__vault.read(path);
    },
    { path, missing: NO_HOOKS },
  );
}

/** Write a note into the vault, as another app would. */
export async function putNote(page: Page, path: string, text: string) {
  await page.evaluate(
    ({ path, text, missing }) => {
      if (globalThis.__vault == null) {
        throw new Error(missing);
      }
      globalThis.__vault.write(path, text);
    },
    { path, text, missing: NO_HOOKS },
  );
}

/** Slow every vault call, and fail the next `write` of one file. */
export async function slowVaultAndFailWrite(
  page: Page,
  latencyMs: number,
  fileName: string,
) {
  await page.evaluate(
    ({ latencyMs, fileName, missing }) => {
      if (globalThis.__vault == null) {
        throw new Error(missing);
      }
      globalThis.__vault.setLatency(latencyMs);
      globalThis.__vault.failNext("write", fileName);
    },
    { latencyMs, fileName, missing: NO_HOOKS },
  );
}

/**
 * Come back to the browser tab. The browser fires `visibilitychange`,
 * and the store reads the vault again, as a phone does on its return to
 * the foreground.
 */
export async function returnToTab(page: Page) {
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
}
