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
