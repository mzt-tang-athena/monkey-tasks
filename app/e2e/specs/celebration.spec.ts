import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "../fixtures";
import { completedNotes, undated } from "../data";
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

/** The run saw one burst and then none, or no burst at all under
    reduced motion. */
async function expectBurstRule(page: Page, testInfo: TestInfo) {
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

    await expectBurstRule(page, testInfo);
  });

  test("a mark done in the editor sheet plays a burst, and it clears", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const target = row(page, undated.first);
    await press(page, target.getByRole("button", { name: undated.first }));
    const editor = page.getByRole("dialog", { name: "Task" });
    const mark = editor.getByRole("button", { name: "mark done" });
    await expect(mark).toBeVisible();
    await watchBurst(page);

    await press(page, mark);
    await expect(target.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await expectBurstRule(page, testInfo);
  });

  test("a sheet that reopens a done task plays no burst", async ({
    page,
  }) => {
    await page.goto("/");
    const target = row(page, completedNotes.timed);
    await press(page, target.getByRole("button", { name: completedNotes.timed }));
    const editor = page.getByRole("dialog", { name: "Task" });
    const reopen = editor.getByRole("button", { name: "mark not done" });
    await expect(reopen).toBeVisible();
    await watchBurst(page);

    await press(page, reopen);
    await expect(target.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "false",
    );

    // No project reduces motion here: the sheet's tick never plays on a
    // reopen, whatever the motion setting.
    await page.waitForTimeout(150);
    expect(await burstSeen(page)).toBe(false);
    await page.waitForTimeout(600);
    await expect(page.getByTestId("tick-burst")).toHaveCount(0);
  });
});
