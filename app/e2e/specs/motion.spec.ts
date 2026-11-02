import { expect, pauseClock, test } from "../fixtures";
import { sections, tabs, undated } from "../data";
import { swipe } from "../gestures";
import { listTab, row, sectionHeader } from "../locators";

/** The slide is 220 ms (`src/components/swipe-pager.tsx`). */
const slideBudgetMs = 500;

test("a list swipe follows the motion setting", async ({ page, reducedMotion }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  const main = listTab(page, tabs.main);
  const next = listTab(page, tabs.next);

  // The slide runs on the page clock. With the clock stopped, the
  // page stays at the moment the finger lifts until the test moves
  // the clock on. A slow runner cannot let the slide end between the
  // release and a read.
  await pauseClock(page);
  await swipe(page, sectionHeader(page, sections.today), "left");

  if (reducedMotion === "reduce") {
    // Nothing slides: the page turns with no clock time.
    await expect(next).toHaveAttribute("aria-selected", "true");
    await expect(main).toHaveAttribute("aria-selected", "false");
  } else {
    // The page slides out first, then the tab changes.
    await expect(main).toHaveAttribute("aria-selected", "true");
    await expect(next).toHaveAttribute("aria-selected", "false");
    await page.clock.runFor(slideBudgetMs);
    await expect(next).toHaveAttribute("aria-selected", "true");
  }
  await page.clock.resume();
});
