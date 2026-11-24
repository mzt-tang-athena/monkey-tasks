import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { undated } from "../data";
import { pane, search, swipeDownPx, swipeOpen } from "../commands";
import { pullDown, touchDrag, touchHold } from "../gestures";
import { addButton, listTab, row } from "../locators";

/**
 * The operator's 2026-11-24 design: the bar's action is one wide Add
 * button. A tap adds, a swipe down opens the command pane, and a swipe
 * left or right moves one tab. A swipe that stays under the commit is
 * still a tap, so a hand that moves a little still adds.
 *
 * The button also carries the three jobs as custom actions and arrow
 * keys; the surface's unit test holds that wiring, and this file drives
 * the finger on it.
 */

/** The sheet a tap opens. */
function sheet(page: Page) {
  return page.getByRole("dialog", { name: "Add a task" });
}

/** A tab is the one on screen, by its name and its own state. */
async function expectTab(
  page: Page,
  name: string,
  url: string,
) {
  await expect(page).toHaveURL(url);
  await expect(listTab(page, name)).toHaveAttribute("aria-selected", "true");
}

test.describe("a tap", () => {
  test("opens the tab's own Add", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await addButton(page).click();

    await expect(sheet(page)).toBeVisible();
  });

  test("that moves a little still adds", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    const box = await addButton(page).boundingBox();
    if (box == null) {
      throw new Error("the Add button has no box");
    }
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Past the 8 px a press travels and under the button's 24 px
    // commit, drawn out slowly so no flick can turn it into a swipe.
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 4; step += 1) {
      await page.mouse.move(x + step * 3, y);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();

    await expect(sheet(page)).toBeVisible();
    await expect(pane(page)).toHaveCount(0);
  });
});

test.describe("a swipe down", () => {
  test("opens the command pane with the search focused", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await swipeOpen(page);

    await expect(pane(page)).toBeVisible();
    await expect(search(page)).toBeFocused();
  });

  test("opens it with the mouse too", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await pullDown(page, "mouse", addButton(page), swipeDownPx);

    await expect(pane(page)).toBeVisible();
  });
});

test.describe("a sideways swipe", () => {
  test("left shows the tab on the right", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await touchDrag(page, addButton(page), -40);

    await expectTab(page, "Planner", "/planner");
  });

  test("right shows the tab on the left", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();

    await touchDrag(page, addButton(page), 40);

    await expectTab(page, "Lists", "/");
  });

  test("stops at either end of the bar", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await touchDrag(page, addButton(page), 40);
    await expectTab(page, "Lists", "/");

    await page.goto("/journal");
    await expect(page.getByTestId("journal-screen")).toBeVisible();
    await touchDrag(page, addButton(page), -40);
    await expectTab(page, "Journal", "/journal");
  });
});

test.describe("a swipe up", () => {
  test("opens nothing and adds nothing", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await touchDrag(page, addButton(page), 0, { dy: -40 });

    await expect(pane(page)).toHaveCount(0);
    await expect(sheet(page)).toHaveCount(0);
    await expectTab(page, "Lists", "/");
  });
});

test.describe("the hint of motion", () => {
  test("the button follows the finger, and reduce holds it still", async ({
    page,
    reducedMotion,
  }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    const rest = await addButton(page).boundingBox();

    // A cancel runs no action, so the button's own return is the only
    // thing the gesture leaves behind.
    await touchHold(page, addButton(page), 0, async () => {
      await page.waitForTimeout(60);
      const moved = await addButton(page).boundingBox();
      const travel = (moved?.y ?? 0) - (rest?.y ?? 0);
      if (reducedMotion === "reduce") {
        expect(Math.abs(travel)).toBeLessThan(1);
      } else {
        expect(travel).toBeGreaterThan(3);
      }
    }, { dy: 20, end: "touchCancel" });

    // Whatever the finger did, the button returns to its place.
    await expect
      .poll(async () => {
        const back = await addButton(page).boundingBox();
        return Math.abs((back?.y ?? 0) - (rest?.y ?? 0));
      })
      .toBeLessThan(1);
  });
});

test.describe("the bar's layout", () => {
  test("four tabs and the Add button fit 360 wide", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    const targets = ["Lists", "Planner", "Inbox Notes", "Journal"];
    for (const name of targets) {
      const box = await listTab(page, name).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360.5);
    }

    // One wide button, not two halves: the glyph and the word.
    const add = await addButton(page).boundingBox();
    expect(add?.width ?? 0).toBeGreaterThanOrEqual(87.5);
    expect(add?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    expect((add?.x ?? 0) + (add?.width ?? 0)).toBeLessThanOrEqual(360.5);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the bar's glyphs draw at 24pt inside their targets", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    for (const name of ["list", "calendar", "journal", "inbox", "plus"]) {
      const box = await page
        .locator(`[data-testid="icon:${name}"], [data-testid="icon:${name}:fill"]`)
        .filter({ visible: true })
        .first()
        .boundingBox();
      expect(box, name).not.toBeNull();
      expect(box?.width ?? 0, name).toBeCloseTo(24, 0);
      expect(box?.height ?? 0, name).toBeCloseTo(24, 0);
    }
  });
});
