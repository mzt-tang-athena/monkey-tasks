import { expect, test } from "../fixtures";
import { sections, supplements, tabs, undated } from "../data";
import { holdDrag, swipe, touchSwipe } from "../gestures";
import { expectAbove, listTab, row, sectionHeader } from "../locators";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
});

test.describe("tab swipe", () => {
  test("a swipe left turns to the next list", async ({ page }) => {
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");

    await swipe(page, sectionHeader(page, sections.today), "left");

    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "false");
  });

  test("a short swipe keeps the list", async ({ page }) => {
    await swipe(page, sectionHeader(page, sections.today), "left", "short");

    // The page springs back. Give it the time a slide would take, then
    // check that nothing turned.
    await page.waitForTimeout(500);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "false");
  });

  test("a swipe that starts on a row does not open the editor", async ({
    page,
    reducedMotion,
  }) => {
    // B1: a mouse swipe that starts on a row ends with a click on that
    // row, and the pager does not swallow it. With reduced motion the
    // page turns at pointer up, so the row is gone before the click
    // lands, and the bug does not show. Ticket 0059 fixes it and
    // removes this mark.
    test.fail(reducedMotion !== "reduce", "B1, fixed by ticket 0059");

    await swipe(page, row(page, supplements), "left");

    await expect(
      listTab(page, tabs.next),
      "the swipe turns the page, and the row's editor stays closed",
    ).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL("/");
  });
});

test.describe("tab swipe on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("a touch swipe turns the page", async ({ page }) => {
    // B2: the swipe body keeps `touch-action: auto`, so the browser
    // claims the pan and cancels the pointer. Ticket 0059 fixes it and
    // removes this mark.
    test.fail();

    await touchSwipe(page, sectionHeader(page, sections.today), "left");

    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true", {
      timeout: 2000,
    });
  });
});

test.describe("My order", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("button", { name: "sort list" }).click();
    await page.getByRole("button", { name: "My order" }).click();
    await expectAbove(row(page, undated.first), row(page, undated.second));
  });

  test("the sort sheet marks the order in use", async ({ page }) => {
    await page.getByRole("button", { name: "sort list" }).click();

    await expect(page.getByRole("button", { name: "My order" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("button", { name: "Due date" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  test("each row has a named reorder handle", async ({ page }) => {
    // B4: the grip rendered six dots with no name.
    const grip = page.getByTestId(`reorder-grip:${undated.second}`);

    await expect(grip).toHaveRole("button");
    await expect(grip).toHaveAccessibleName("reorder handle");
    await expect(page.getByRole("button", { name: "reorder handle" }).first()).toBeVisible();
    // It has no keyboard action yet (0063), so it is no tab stop.
    await expect(grip).toHaveAttribute("tabindex", "-1");
  });

  test("a held row moves and keeps its place", async ({ page }) => {
    await holdDrag(page, row(page, undated.second), row(page, undated.first), {
      at: "upper",
    });

    await expectAbove(row(page, undated.second), row(page, undated.first));

    // The order is written, not only drawn: it survives a tab round
    // trip.
    await listTab(page, tabs.next).click();
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await listTab(page, tabs.main).click();
    await expectAbove(row(page, undated.second), row(page, undated.first));
  });

  test("the grip lifts a row without a hold", async ({ page }) => {
    await holdDrag(
      page,
      page.getByTestId(`reorder-grip:${undated.second}`),
      row(page, undated.first),
      { at: "upper", holdMs: 0 },
    );

    await expectAbove(row(page, undated.second), row(page, undated.first));
  });
});
