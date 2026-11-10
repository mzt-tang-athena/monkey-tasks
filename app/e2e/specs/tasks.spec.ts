import { expect, test } from "../fixtures";
import { rename, sections, undated } from "../data";
import { expectInSection, press, row, sectionHeader } from "../locators";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
});

test("a tick marks the task done and moves it to Completed", async ({ page }) => {
  const target = row(page, undated.second);

  await press(page, target.getByRole("button", { name: "mark done" }));

  await expect(target.getByRole("button", { name: "mark not done" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expectInSection(target, sectionHeader(page, sections.completed));
});

test("an untick puts the task back under No date", async ({ page }) => {
  const target = row(page, undated.second);
  await press(page, target.getByRole("button", { name: "mark done" }));
  await expectInSection(target, sectionHeader(page, sections.completed));

  await press(page, target.getByRole("button", { name: "mark not done" }));

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

test("a single-line row has equal space above and below its name", async ({ page }) => {
  // ADR 0012: a row pads its text the same on both sides. The row once
  // drew an empty meta row under the name, which added 2 px below it.
  const target = row(page, undated.second);

  // Every sample task is new, so each row lands on load and moves for
  // 220 ms. Two separate reads can catch the row in two places. One
  // read takes both boxes from the same frame, and the landing moves
  // them together.
  const { above, below } = await target.evaluate((outer, text) => {
    const label = [...outer.querySelectorAll("*")].find(
      (node) => node.children.length === 0 && node.textContent === text,
    );
    if (label == null) {
      throw new Error(`no label reads "${text}"`);
    }
    const box = outer.getBoundingClientRect();
    const name = label.getBoundingClientRect();
    return { above: name.top - box.top, below: box.bottom - name.bottom };
  }, undated.second);

  expect(below).toBeCloseTo(above, 0);
});

test("the editor saves a new name", async ({ page }) => {
  await press(page, row(page, rename.from).getByRole("button", { name: "open task" }));
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await expect(name).toHaveValue(rename.from);

  await name.fill(rename.to);
  await page.getByRole("button", { name: "save task" }).click();

  await expect(page).toHaveURL("/");
  await expect(row(page, rename.to)).toBeVisible();
  await expect(row(page, rename.from)).toHaveCount(0);
});
