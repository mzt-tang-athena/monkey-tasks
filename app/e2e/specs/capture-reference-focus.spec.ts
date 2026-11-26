import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { capture, references, undated } from "../data";
import { openMain, press, row } from "../locators";

// The capture sheet's reference picker gives the caret back to the task
// input when it closes (ticket 20261126-reference-keeps-the-keyboard).
// The proof is where focus lands after Done, after a link and after a
// cancel, and that the next keys land in the box.

/** Open capture on a list, which is the only target that offers a link. */
async function openCaptureOnList(page: Page) {
  await page.goto("/");
  await openMain(page);
  await expect(row(page, undated.second)).toBeVisible();
  await page.getByRole("button", { name: "add task" }).click();
  await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();

  // Main has no list to link, so the pill steps until a list's target
  // shows the link control.
  const link = page.getByRole("button", { name: "link a reference" });
  for (let step = 0; step < 6 && !(await link.isVisible()); step++) {
    await press(page, page.getByRole("button", { name: /^target list: / }));
  }
  await expect(link).toBeVisible();
  return page.getByPlaceholder("Add a task");
}

async function expectTypingResumes(page: Page, input: Locator) {
  await expect(input).toBeFocused();
  await page.keyboard.type(" and milk");
  await expect(input).toHaveValue(`${capture.typed} and milk`);
}

test("Done with no link leaves the caret in the capture box", async ({ page }) => {
  const input = await openCaptureOnList(page);
  await input.fill(capture.typed);
  await expect(input).toBeFocused();

  await page.getByRole("button", { name: "link a reference" }).click();
  await expect(page.getByRole("dialog", { name: "Reference" })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await expect(page.getByRole("dialog", { name: "Reference" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
  await expectTypingResumes(page, input);
});

test("a linked reference leaves the caret in the capture box", async ({ page }) => {
  const input = await openCaptureOnList(page);
  await input.fill(capture.typed);

  await page.getByRole("button", { name: "link a reference" }).click();
  const picker = page.getByRole("dialog", { name: "Reference" });
  await expect(picker).toBeVisible();
  await picker.getByRole("textbox", { name: "Find a reference" }).fill("oats");
  await press(
    page,
    picker.getByRole("button", {
      name: `${references.oatmeal}, physical, recipes`,
    }),
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await expect(page.getByRole("dialog", { name: "Reference" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `remove reference ${references.oatmeal}` }),
  ).toBeVisible();
  await expectTypingResumes(page, input);
});

test("a cancel leaves the caret in the capture box", async ({ page }) => {
  const input = await openCaptureOnList(page);
  await input.fill(capture.typed);

  await page.getByRole("button", { name: "link a reference" }).click();
  await expect(page.getByRole("dialog", { name: "Reference" })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog", { name: "Reference" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
  await expectTypingResumes(page, input);
});
