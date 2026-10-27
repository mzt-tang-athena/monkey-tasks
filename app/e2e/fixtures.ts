import { test as base } from "@playwright/test";
import { TODAY } from "./data";

export { TODAY };

/**
 * The suite's `test`: every page starts on TODAY. `clock.install` pins
 * the start and lets time run. Never freeze the clock: the row
 * entrance waits on time passing, so a frozen clock leaves every row
 * invisible.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.install({ time: TODAY });
    await use(page);
  },
});

export { expect } from "@playwright/test";
