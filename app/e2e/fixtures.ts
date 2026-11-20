import { test as base, type Page } from "@playwright/test";
import { TODAY } from "./data";

export { TODAY };

/**
 * Chromium aborts the loads in flight with this error when the host's
 * network changes. A container network that comes or goes, or any
 * address that appears on the host, does it, even for localhost. A page
 * that lost a request it boots from stays blank, so the test fails on a
 * row that never comes.
 */
const networkChanged = "net::ERR_NETWORK_CHANGED";

/**
 * The suite's `test`: every page starts on TODAY. `clock.install` pins
 * the start and lets time run. Never freeze the clock before the rows
 * show: the row entrance waits on time passing, so a frozen clock
 * leaves every row invisible.
 *
 * A network change blanks one page load at random (ticket
 * 20261120-e2e-survives-a-network-change), so a page whose request to
 * its own origin fails with `net::ERR_NETWORK_CHANGED` reloads once.
 * The reload is a load too, so it tries twice when another change
 * aborts it. Any other failure, and a second change after the reload,
 * still fails the test.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.install({ time: TODAY });
    recoverFromNetworkChange(page);
    await use(page);
  },
});

function recoverFromNetworkChange(page: Page) {
  let recovered = false;
  page.on("requestfailed", (request) => {
    if (recovered) return;
    if (request.failure()?.errorText !== networkChanged) return;
    const origin = originOf(page.url());
    if (origin == null || originOf(request.url()) !== origin) return;
    recovered = true;
    void reloadOnce(page);
  });
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Reload after the load event. A reload that starts while the test's
 * own `page.goto` still waits for that event cancels the navigation,
 * and the goto throws instead of returning.
 */
async function reloadOnce(page: Page) {
  await page.waitForLoadState("load").catch(() => {});
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.reload();
      return;
    } catch (error) {
      // The reload is a load too, so a network change can abort it.
      if (!String(error).includes(networkChanged)) return;
    }
  }
}

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
