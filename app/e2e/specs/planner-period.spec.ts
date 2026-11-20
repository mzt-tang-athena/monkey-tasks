import type { Page, TestInfo } from "@playwright/test";
import { expect, pauseClock, test } from "../fixtures";
import { dragPx, mouseHold, touchCancel, touchHold } from "../gestures";
import { press } from "../locators";

/**
 * The planner's period strip follows the swipe. Each mode keeps a
 * filled mark on the period on screen, and the mark rides the pager's
 * live position on the UI thread, so it sits between two cells at half
 * a page (ADR 0046).
 */

test.use({ viewport: { width: 412, height: 915 } });

function isMotion(testInfo: TestInfo): boolean {
  return testInfo.project.name !== "reduced-motion";
}

/** One strip's cells and its mark, as boxes on the page. */
async function strip(page: Page, name: "days" | "weeks" | "months") {
  const rail = page.getByRole("tablist", { name });
  const cells = rail.getByRole("tab");
  const count = await cells.count();
  const read = async (index: number) => {
    const box = await cells.nth(index).boundingBox();
    if (box == null) {
      throw new Error(`the ${name} cell ${index} has no box`);
    }
    return box;
  };
  const markLocator = page.getByTestId(`${name}-mark`);
  // The mark takes the row's cell places from layout, so wait for them.
  await expect
    .poll(async () => Math.round((await markLocator.boundingBox())?.width ?? 0))
    .toBe(44);
  const mark = (await markLocator.boundingBox())!;
  return { rail, cells, count, read, mark };
}

/**
 * A half swipe on the body. The mark sits between the two cells while
 * the finger holds, and lands on the next one after the release.
 */
async function followsHalfSwipe(
  page: Page,
  testInfo: TestInfo,
  body: string,
  name: "days" | "weeks" | "months",
  input: "mouse" | "touch" = "mouse",
) {
  const hold =
    input === "touch"
      ? (dx: number, during: () => Promise<void>) =>
          touchHold(page, page.getByTestId(body), dx, during)
      : (dx: number, during: () => Promise<void>) =>
          mouseHold(page, page.getByTestId(body), dx, during);
  await page.getByTestId(body).waitFor();
  const at = await strip(page, name);
  // The cell the mark rests on, and the one the swipe turns to.
  let cell = 0;
  for (let index = 0; index < at.count; index++) {
    if (Math.abs((await at.read(index)).x - at.mark.x) <= 2) {
      cell = index;
      break;
    }
  }
  const first = await at.read(cell);
  const next = await at.read(cell + 1);
  const step = next.x - first.x;
  expect(step, "the two cells stand apart").toBeGreaterThan(40);

  const half = -(await page.getByTestId(body).boundingBox())!.width / 2;
  await pauseClock(page);
  await hold(half, async () => {
    await page.clock.runFor(32);
    const during = (await strip(page, name)).mark;
    if (isMotion(testInfo)) {
      expect(during.x, "the mark left its cell").toBeGreaterThan(first.x + 4);
      expect(during.x, "the mark has not reached the next cell").toBeLessThan(next.x);
      // Half a page puts it halfway between the two cells.
      const middle = first.x + step / 2;
      expect(Math.abs(during.x - middle), "the mark sits halfway").toBeLessThan(12);
    } else {
      expect(during.x, "reduce motion keeps the mark at rest").toBeCloseTo(first.x, 0);
    }
  });
  await page.clock.runFor(600);
  await page.clock.resume();

  // The mark lands on the period the pager turned to.
  await expect
    .poll(async () => Math.round((await strip(page, name)).mark.x - next.x))
    .toBeLessThanOrEqual(2);
  await expect(at.cells.nth(cell + 1)).toHaveAttribute("aria-selected", "true");
  await expect(at.cells.nth(cell)).toHaveAttribute("aria-selected", "false");
}

test("the day mark follows a half swipe", async ({ page }, testInfo) => {
  await page.goto("/planner");
  await followsHalfSwipe(page, testInfo, "day-pager", "days");
});

test("the day mark rides a swipe over a month boundary", async ({ page }, testInfo) => {
  // The 31st is the sixth of the seven days around today, and the next
  // day opens December's neighbour: November.
  await page.goto("/planner?day=2026-10-31");
  const at = await strip(page, "days");
  await expect(at.cells.nth(5)).toHaveAttribute("aria-selected", "true");
  await expect(at.cells.nth(6)).toHaveAccessibleName("Sun 1");

  const before = (await strip(page, "days")).mark;
  await pauseClock(page);
  const half = -(await page.getByTestId("day-pager").boundingBox())!.width / 2;
  await mouseHold(page, page.getByTestId("day-pager"), half, async () => {
    await page.clock.runFor(32);
    const during = (await strip(page, "days")).mark;
    if (isMotion(testInfo)) {
      expect(during.x, "the mark left the 31st").toBeGreaterThan(before.x + 4);
    } else {
      expect(during.x, "reduce motion keeps the mark at rest").toBeCloseTo(before.x, 0);
    }
  });
  await page.clock.runFor(600);
  await page.clock.resume();
  await expect(page).toHaveURL(/day=2026-11-01/);
  await expect
    .poll(async () => (await strip(page, "days")).mark.x)
    .toBeGreaterThan(before.x + 40);
});

test("a day far from today keeps its mark and slides the dates", async ({
  page,
}, testInfo) => {
  // Past today's seven days the window follows the shown day, so the
  // mark holds its cell and the dates slide under it.
  await page.goto("/planner?day=2025-06-01");
  const at = await strip(page, "days");
  await expect(at.cells.nth(0)).toHaveAccessibleName("Sun 1");
  await expect(at.cells.nth(0)).toHaveAttribute("aria-selected", "true");
  const rest = at.mark;

  const half = -(await page.getByTestId("day-pager").boundingBox())!.width / 2;
  await pauseClock(page);
  await mouseHold(page, page.getByTestId("day-pager"), half, async () => {
    await page.clock.runFor(32);
    const during = await strip(page, "days");
    if (isMotion(testInfo)) {
      expect(during.mark.x, "the mark holds its cell").toBeCloseTo(rest.x, 0);
      expect(await at.cells.nth(0).textContent(), "the dates did not move").toContain("1");
    } else {
      expect(during.mark.x, "reduce motion keeps the mark at rest").toBeCloseTo(rest.x, 0);
    }
  });
  await page.clock.runFor(600);
  await page.clock.resume();

  await expect
    .poll(async () => Math.round((await strip(page, "days")).mark.x))
    .toBe(Math.round(rest.x));
  await expect(at.cells.nth(0), "the first cell is the day it turned to").toHaveAccessibleName(
    "Mon 2",
  );
  await expect(at.cells.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/day=2025-06-02/);
});

test("the week mark follows a half swipe", async ({ page }, testInfo) => {
  await page.goto("/planner?mode=week");
  await followsHalfSwipe(page, testInfo, "week-pager", "weeks");
});

test("the week mark follows a swipe over a month boundary", async ({ page }, testInfo) => {
  // Today's week starts in October and ends in November, with Monday
  // first. The next week is all November.
  await page.goto("/planner?mode=week");
  const at = await strip(page, "weeks");
  await expect(at.cells.nth(0)).toHaveAccessibleName("week of Oct 26-1 W44");
  await expect(at.cells.nth(1)).toHaveAccessibleName("week of Nov 2-8 W45");

  const before = (await strip(page, "weeks")).mark;
  await pauseClock(page);
  const half = -(await page.getByTestId("week-pager").boundingBox())!.width / 2;
  await mouseHold(page, page.getByTestId("week-pager"), half, async () => {
    await page.clock.runFor(32);
    const during = (await strip(page, "weeks")).mark;
    if (isMotion(testInfo)) {
      expect(during.x, "the mark left its week").toBeGreaterThan(before.x + 4);
      expect(during.x, "the mark is short of the next week").toBeLessThan(before.x + 52);
    } else {
      expect(during.x, "reduce motion keeps the mark at rest").toBeCloseTo(before.x, 0);
    }
  });
  await page.clock.runFor(600);
  await page.clock.resume();
  await expect(at.cells.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/day=2026-11-02/);
});

test("the week mark follows a swipe with weeks starting on Sunday", async ({
  page,
}, testInfo) => {
  await page.goto("/settings");
  await press(
    page,
    page.getByRole("tablist", { name: "week starts on" }).getByRole("tab", { name: "Sunday" }),
  );
  try {
    // Sunday's week starts on the 25th, so the next one opens in
    // November.
    await page.goto("/planner?mode=week");
    const at = await strip(page, "weeks");
    await expect(at.cells.nth(0)).toHaveAccessibleName("week of Oct 25-31 W44");
    await expect(at.cells.nth(1)).toHaveAccessibleName("week of Nov 1-7 W45");

    const before = (await strip(page, "weeks")).mark;
    await pauseClock(page);
    const half = -(await page.getByTestId("week-pager").boundingBox())!.width / 2;
    await mouseHold(page, page.getByTestId("week-pager"), half, async () => {
      await page.clock.runFor(32);
      const during = (await strip(page, "weeks")).mark;
      if (isMotion(testInfo)) {
        expect(during.x, "the mark left its week").toBeGreaterThan(before.x + 4);
      } else {
        expect(during.x, "reduce motion keeps the mark at rest").toBeCloseTo(before.x, 0);
      }
    });
    await page.clock.runFor(600);
    await page.clock.resume();
    await expect(at.cells.nth(1)).toHaveAttribute("aria-selected", "true");
    // Monday stays picked in the week that opens in November.
    await expect(page).toHaveURL(/day=2026-11-02/);
  } finally {
    await page.goto("/settings");
    await press(
      page,
      page.getByRole("tablist", { name: "week starts on" }).getByRole("tab", { name: "Monday" }),
    );
  }
});

test("the month mark follows a half swipe far from today", async ({ page }, testInfo) => {
  // Five months out, the rail's window still starts at today's month.
  await page.goto("/planner?mode=month&day=2027-03-15");
  const at = await strip(page, "months");
  await expect(at.cells.nth(0)).toHaveAccessibleName("2026 Oct");
  await expect(at.cells.nth(4)).toHaveAccessibleName("2027 Feb");
  await expect(at.cells.nth(5)).toHaveAccessibleName("2027 Mar");
  await followsHalfSwipe(page, testInfo, "month-pager", "months");
  await expect(page).toHaveURL(/day=2027-04-01/);
});

test("the mark lands without a step back", async ({ page }, testInfo) => {
  test.skip(!isMotion(testInfo), "reduce motion never moves the mark");
  // Inside today's block the window holds the cells it shows, so a
  // landing never moves them under the mark. The frame that swaps the
  // page's cell for the strip's must not draw the old one.
  await page.goto("/planner");
  await page.getByTestId("day-pager").waitFor();
  const at = await strip(page, "days");
  const half = -(await page.getByTestId("day-pager").boundingBox())!.width / 2;

  await pauseClock(page);
  await mouseHold(page, page.getByTestId("day-pager"), half, async () => {
    await page.clock.runFor(32);
  });
  const frames: number[] = [];
  for (let frame = 0; frame < 24; frame++) {
    await page.clock.runFor(32);
    frames.push(Math.round((await strip(page, "days")).mark.x));
  }
  await page.clock.resume();
  await expect(page).toHaveURL(/day=2026-10-27/);

  const back = frames.reduce(
    (worst, x, index) => (index === 0 ? worst : Math.max(worst, frames[index - 1] - x)),
    0,
  );
  expect(back, `the mark steps back in ${frames.join(",")}`).toBeLessThanOrEqual(1);
  await expect(at.cells.nth(1)).toHaveAttribute("aria-selected", "true");
});

test("a swipe that springs back leaves the strip in place", async ({ page }) => {
  await page.goto("/planner");
  const at = await strip(page, "days");
  const rest = at.mark;

  await pauseClock(page);
  await mouseHold(page, page.getByTestId("day-pager"), -dragPx.short, async () => {
    await page.clock.runFor(32);
  });
  await page.clock.runFor(600);
  await page.clock.resume();

  await expect
    .poll(async () => Math.round((await strip(page, "days")).mark.x - rest.x))
    .toBe(0);
  await expect(at.cells.nth(0)).toHaveAttribute("aria-selected", "true");
});

test.describe("with a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("a half touch swipe moves the day mark", async ({ page }, testInfo) => {
    await page.goto("/planner");
    await followsHalfSwipe(page, testInfo, "day-pager", "days", "touch");
  });

  test("a cancelled touch leaves the strip in place", async ({ page }) => {
    await page.goto("/planner?mode=week");
    const at = await strip(page, "weeks");
    const rest = at.mark;

    await touchCancel(page, page.getByTestId("week-pager"), "left");
    await expect
      .poll(async () => Math.round((await strip(page, "weeks")).mark.x - rest.x))
      .toBe(0);
    await expect(at.cells.nth(0)).toHaveAttribute("aria-selected", "true");
  });
});
