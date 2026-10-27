import { test as base, type Page } from "@playwright/test";
import { TODAY } from "./data";

export { TODAY };

/**
 * The suite's `test`: every page starts on TODAY. `clock.install` pins
 * the start and lets time run. Never freeze the clock before the rows
 * show: the row entrance waits on time passing, so a frozen clock
 * leaves every row invisible.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.install({ time: TODAY });
    await use(page);
  },
});

/**
 * `pauseClock` jumps this far ahead of the page clock. `pauseAt` cannot
 * go back in time, and the page clock runs on between the two calls.
 * The lead is longer than the test timeout, so no slow runner can
 * overtake it. No timer in the app waits this long.
 */
const pauseLeadMs = 60_000;

/**
 * Stop the page clock. No timer and no animation frame runs until the
 * test calls `page.clock.runFor` or `page.clock.resume`. A test then
 * sees the page as it stands, however long its own reads take.
 */
export async function pauseClock(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + pauseLeadMs);
}

export { expect } from "@playwright/test";
