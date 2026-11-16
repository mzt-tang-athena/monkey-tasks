import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { undated } from "../data";
import { press, row } from "../locators";

type Watched = { burstSeen?: boolean };

/**
 * The tick's burst draws above the row, because a ticked row moves to
 * Completed after the tick's 320 ms (ADR 0034). The burst runs for
 * 520 ms, outlives the row, and then removes itself. With reduced
 * motion it never mounts.
 *
 * A watch on the document records the mount. A press resolves well
 * after the event, and on a slow runner the burst can be gone by the
 * first read, so the check reads what the page saw, not what stands.
 */
async function watchBurst(page: Page) {
  await page.evaluate(() => {
    const watched = window as unknown as Watched;
    watched.burstSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="tick-burst"]') != null) {
        watched.burstSeen = true;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

async function burstSeen(page: Page) {
  return page.evaluate(
    () => (window as unknown as Watched).burstSeen === true,
  );
}

test.describe("completion celebration", () => {
  test("a tick plays one burst, and it clears itself", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const tick = row(page, undated.second).getByRole("checkbox", {
      name: undated.second,
    });
    await expect(tick).toHaveAttribute("aria-checked", "false");
    await watchBurst(page);

    await press(page, tick);
    await expect(tick).toHaveAttribute("aria-checked", "true");

    if (testInfo.project.name === "reduced-motion") {
      // A burst would still stand at 150 ms. The watch would have seen
      // one mount at any point before this read.
      await page.waitForTimeout(150);
      expect(await burstSeen(page)).toBe(false);
      await page.waitForTimeout(600);
      await expect(page.getByTestId("tick-burst")).toHaveCount(0);
      return;
    }

    await expect.poll(() => burstSeen(page)).toBe(true);
    await expect(page.getByTestId("tick-burst")).toHaveCount(0, {
      timeout: 2500,
    });
  });
});
