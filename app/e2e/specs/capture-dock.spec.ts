import { expect, test } from "../fixtures";
import { capture, undated } from "../data";
import { row } from "../locators";
import type { Locator, Page } from "@playwright/test";

// ADR 0010 caps content at 720. On a 1280 wide window the column runs
// from 280 to 1000, and the floating chrome sits inside it.
const wide = { width: 1280, height: 800 };
const column = { left: (wide.width - 720) / 2, right: (wide.width + 720) / 2 };

/** Fail the next create of the captured note. */
async function failCapture(page: Page) {
  await page.evaluate((fileName) => {
    globalThis.__vault?.failNext("create", fileName);
  }, `${capture.name}.md`);
}

async function expectInColumn(target: Locator, what: string) {
  const box = await target.boundingBox();
  expect(box, `${what} is on screen`).not.toBeNull();
  expect(box!.x, `${what} starts inside the column`).toBeGreaterThanOrEqual(
    column.left - 1,
  );
  expect(
    box!.x + box!.width,
    `${what} ends inside the column`,
  ).toBeLessThanOrEqual(column.right + 1);
}

test.describe("the floating chrome on a wide window", () => {
  test.use({ viewport: wide });

  test("the bar row, the sheet and the toast sit inside the column", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await expectInColumn(page.getByRole("tab", { name: "Lists" }), "the Lists tab");
    await expectInColumn(
      page.getByRole("button", { name: "add task" }),
      "the Add button",
    );

    await page.getByRole("button", { name: "add task" }).click();
    await page.getByPlaceholder("Add a task").fill(capture.typed);
    await expectInColumn(page.getByRole("dialog"), "the sheet");

    await failCapture(page);
    await page.getByRole("button", { name: "send task" }).click();
    await expectInColumn(page.getByRole("alert"), "the toast");
  });

  test("the editor header sits inside the column", async ({ page }) => {
    await page.goto("/");
    await row(page, undated.second).click();

    await expectInColumn(
      page.getByRole("button", { name: "cancel editing" }),
      "Cancel",
    );
    await expectInColumn(page.getByRole("button", { name: "save task" }), "Save");
  });
});

test("a failed capture shows the toast, and Retry sends the same draft", async ({
  page,
}) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await failCapture(page);

  await page.getByRole("button", { name: "add task" }).click();
  await page.getByPlaceholder("Add a task").fill(capture.typed);
  await page.getByRole("button", { name: "send task" }).click();

  await expect(page.getByText(`create failed: ${capture.name}.md`)).toBeVisible();
  await expect(row(page, capture.name)).toHaveCount(0);

  await page.getByRole("button", { name: "retry capture" }).click();
  await expect(row(page, capture.name)).toBeVisible();
  await expect(page.getByText(/create failed/)).toHaveCount(0);
});

test("a failed capture toast belongs to its tab and shows over no other screen", async ({
  page,
}) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await failCapture(page);

  await page.getByRole("button", { name: "add task" }).click();
  await page.getByPlaceholder("Add a task").fill(capture.typed);
  await page.getByRole("button", { name: "send task" }).click();
  await expect(page.getByRole("alert")).toHaveCount(1);

  // The editor opens over the tab. No toast floats over it.
  await row(page, undated.second).click();
  await expect(page.getByRole("button", { name: "save task" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Back on the tab, the toast is still there, with its draft.
  await page.getByRole("button", { name: "cancel editing" }).click();
  await expect(page.getByRole("alert")).toHaveCount(1);

  // The other tab shows no toast of this tab.
  await page.getByRole("tab", { name: "Planner" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test.describe("the sheet belongs to its tab", () => {
  // The bar slides away under the open sheet, and the scrim covers the
  // screen, so the keyboard is the only way past the sheet. The screen
  // is hidden from roles while the sheet shows, so the specs find its
  // controls by label.
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await page.getByRole("button", { name: "add task" }).click();
    await page.getByPlaceholder("Add a task").fill(capture.typed);
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("a nav tab reached by keyboard closes the sheet", async ({ page }) => {
    await page.locator('[role="tab"][aria-label="Planner"]').focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/planner$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByPlaceholder("Add a task")).toHaveCount(0);

    await page.getByRole("tab", { name: "Lists" }).click();
    await expect(row(page, undated.second)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a row opened by keyboard shows the editor with no sheet over it", async ({
    page,
  }) => {
    await row(page, undated.second).locator('[aria-label="open task"]').focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("button", { name: "save task" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "cancel editing" }).click();
    await expect(row(page, undated.second)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
