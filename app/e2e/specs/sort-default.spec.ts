import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { sections, supplements, undated } from "../data";
import { row, sectionHeader } from "../locators";

/**
 * The operator's 2026-11-24 feedback: Lists opens in My order, and the
 * sort menu lists it first. A phone that saved Due date keeps it. The
 * fixture stores no order, so this file reads the fresh install.
 */

function radio(page: Page, name: string): Locator {
  return page
    .getByRole("radiogroup", { name: "Sort list" })
    .getByRole("radio", { name, exact: true });
}

async function openSort(page: Page): Promise<void> {
  await page.getByRole("button", { name: "sort list" }).click();
  await expect(page.getByRole("radiogroup", { name: "Sort list" })).toBeVisible();
}

test("a fresh install opens Lists in My order", async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();

  // One headerless group: no dated section stands, and the markup rows
  // keep their manual order.
  await expect(sectionHeader(page, sections.today)).toHaveCount(0);
  await expect(sectionHeader(page, sections.undated)).toHaveCount(0);
  await expect(supplements).toBeDefined();
  const first = await row(page, undated.first).boundingBox();
  const second = await row(page, undated.second).boundingBox();
  expect((first?.y ?? 0) < (second?.y ?? 0)).toBe(true);
});

test("the sort button shows no changed mark in My order", async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();

  await expect(page.getByTestId("icon:sort")).toBeVisible();
  await expect(page.getByTestId("icon:sort:fill")).toHaveCount(0);
});

test("the sort menu lists My order first and marks it checked", async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await openSort(page);

  await expect(radio(page, "My order Drag rows to sort")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(radio(page, "Due date Soonest first")).toHaveAttribute(
    "aria-checked",
    "false",
  );

  const mine = await radio(page, "My order Drag rows to sort").boundingBox();
  const due = await radio(page, "Due date Soonest first").boundingBox();
  expect((mine?.y ?? 0) < (due?.y ?? 0)).toBe(true);
});

test("a saved Due date survives the update", async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();

  // The phone saved Due date before the default moved.
  await page.evaluate(() => {
    globalThis.localStorage.setItem("monkey-tasks.sort-mode", "due");
  });
  await page.reload();
  await expect(row(page, undated.second)).toBeVisible();

  await expect(sectionHeader(page, sections.today)).toBeVisible();
  await openSort(page);
  await expect(radio(page, "Due date Soonest first")).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
