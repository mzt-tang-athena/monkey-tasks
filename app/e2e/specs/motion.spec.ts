import { expect, test } from "../fixtures";
import { sections, tabs, undated } from "../data";
import { swipe } from "../gestures";
import { listTab, row, sectionHeader } from "../locators";

/** The slide is 220 ms (`src/components/SwipePager.tsx`). */
const slideBudgetMs = 500;

test("a list swipe follows the motion setting", async ({ page, reducedMotion }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  const main = listTab(page, tabs.main);
  const next = listTab(page, tabs.next);

  await swipe(page, sectionHeader(page, sections.today), "left");

  // Read the tabs once, at the moment the finger lifts: `swipe`
  // returns right after the release. A web-first assertion would
  // wait, and hide the difference.
  const atRelease = {
    main: await main.getAttribute("aria-selected"),
    next: await next.getAttribute("aria-selected"),
  };
  if (reducedMotion === "reduce") {
    // Nothing slides: the page turns at the release.
    expect(atRelease).toEqual({ main: "false", next: "true" });
  } else {
    // The page slides out first, then the tab changes.
    expect(atRelease).toEqual({ main: "true", next: "false" });
    await expect(next).toHaveAttribute("aria-selected", "true", {
      timeout: slideBudgetMs,
    });
  }
});
