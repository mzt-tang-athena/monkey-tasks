import { expect, test } from "../fixtures";
import { capture, undated } from "../data";
import { expectInSection, row, sectionHeader } from "../locators";

test("a capture with a date phrase lands on its day", async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();

  await page.getByRole("button", { name: "add task" }).click();
  await page.getByPlaceholder("Add a task").fill(capture.typed);

  // The chips read the parse before the send.
  await expect(page.getByText(capture.chipDay, { exact: true })).toBeVisible();
  await expect(page.getByText(capture.chipTime, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "send task" }).click();

  const landed = row(page, capture.name);
  await expect(landed).toBeVisible();
  await expect(landed).toContainText(capture.chipTime);
  await expectInSection(
    landed,
    sectionHeader(page, capture.section),
    sectionHeader(page, capture.nextSection),
  );
});
