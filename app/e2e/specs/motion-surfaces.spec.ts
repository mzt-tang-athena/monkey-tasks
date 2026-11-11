import { expect, pauseClock, test } from "../fixtures";
import { undated } from "../data";
import { expectTouchAction, holdDrag } from "../gestures";
import { row } from "../locators";
import type { Locator, Page } from "@playwright/test";

// The motion check on the dev screen is a drag surface with two zones
// in a MotionScrollView (`features/diagnostics/components/motion-check.tsx`).
const chip = "motion-check:chip";
const result = "motion-check:result";

test("a row source keeps pan-y, so the page still scrolls under it", async ({ page }) => {
  await page.goto("/dev");
  await expectTouchAction(page.getByTestId(chip), "pan-y");
});

test("a held drag drops on the zone under the finger", async ({ page }) => {
  await page.goto("/dev");
  await holdDrag(page, page.getByTestId(chip), page.getByTestId("motion-check:B"));
  await expect(page.getByTestId(result)).toHaveText("chip dropped on B");
});

test("a press shorter than the hold lifts nothing", async ({ page }) => {
  await page.goto("/dev");
  await holdDrag(page, page.getByTestId(chip), page.getByTestId("motion-check:A"), {
    holdMs: 100,
  });
  await expect(page.getByTestId(result)).toHaveText("hold the chip, drop it on a box");
});

/** The page scroller's offset. */
const scrollTop = (page: Page) =>
  page.evaluate(() =>
    Math.max(...[...document.querySelectorAll("div")].map((element) => element.scrollTop)),
  );

/** A CDP touch from `from` to `toY`, held for `holdMs` first. */
async function touchDrag(page: Page, from: Locator, toY: number, holdMs: number) {
  const box = await from.boundingBox();
  if (box == null) {
    throw new Error(`${from} has no box`);
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", at?: { x: number; y: number }) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: at == null ? [] : [at] });
  await pauseClock(page);
  await touch("touchStart", { x, y });
  await page.clock.runFor(holdMs);
  await page.clock.resume();
  for (let i = 1; i <= 12; i++) {
    await touch("touchMove", { x, y: y + ((toY - y) * i) / 12 });
    await page.waitForTimeout(16);
  }
  await touch("touchEnd");
  await cdp.detach();
}

test("a touch swipe that lifts nothing scrolls the page", async ({ page }) => {
  await page.goto("/dev");
  const box = page.getByTestId("motion-check:B");
  const top = (await box.boundingBox())?.y ?? 0;
  await touchDrag(page, box, top - 200, 0);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);
});

test("a touch drag holds the scroller still and drops", async ({ page }) => {
  await page.goto("/dev");
  const to = await page.getByTestId("motion-check:B").boundingBox();
  await touchDrag(page, page.getByTestId(chip), (to?.y ?? 0) + 36, 350);
  await expect(page.getByTestId(result)).toHaveText("chip dropped on B");
  expect(await scrollTop(page)).toBe(0);
});

test("a menu opens at full size with reduced motion", async ({ page, reducedMotion }) => {
  test.skip(reducedMotion !== "reduce", "the motion project plays the entrance");
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await page.getByRole("button", { name: "list menu" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const look = await menu.evaluate((element) => {
    const style = getComputedStyle(element);
    return { opacity: style.opacity, transform: style.transform, animation: style.animationName };
  });
  expect(look).toEqual({ opacity: "1", transform: "none", animation: "none" });
});
