import { expect, test } from "../fixtures";
import { rename, sections, undated } from "../data";
import { expectInSection, row, sectionHeader } from "../locators";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
});

test("a tick marks the task done and moves it to Completed", async ({ page }) => {
  const target = row(page, undated.second);

  await target.getByRole("button", { name: "mark done" }).click();

  await expect(target.getByRole("button", { name: "mark not done" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expectInSection(target, sectionHeader(page, sections.completed));
});

test("an untick puts the task back under No date", async ({ page }) => {
  const target = row(page, undated.second);
  await target.getByRole("button", { name: "mark done" }).click();
  await expectInSection(target, sectionHeader(page, sections.completed));

  await target.getByRole("button", { name: "mark not done" }).click();

  await expect(target.getByRole("button", { name: "mark done" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expectInSection(
    target,
    sectionHeader(page, sections.undated),
    sectionHeader(page, sections.completed),
  );
});

test("the editor saves a new name", async ({ page }) => {
  await row(page, rename.from).getByRole("button", { name: "open task" }).click();
  const name = page.getByRole("textbox", { name: "Task name" });
  await expect(name).toHaveValue(rename.from);

  await name.fill(rename.to);
  await page.getByRole("button", { name: "save task" }).click();

  await expect(page).toHaveURL("/");
  await expect(row(page, rename.to)).toBeVisible();
  await expect(row(page, rename.from)).toHaveCount(0);
});
