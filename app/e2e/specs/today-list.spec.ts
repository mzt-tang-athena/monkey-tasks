import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { supplements, supplementsTick, tabs, undated } from "../data";
import {
  expectAbove,
  listTab,
  openMain,
  press,
  row,
  sectionHeader,
} from "../locators";
import { noteText, returnToTab } from "../vault";

/**
 * Ticket 20261125-today-list: a built-in Today list leads the tabs, due
 * today with the past tasks above them, and Settings switches it off.
 * A tick leaves it, and a capture taken there is due today.
 */

/** The sample's overdue task, the first row of the Past group. */
const past = "Return library books";
/** A due-today task that is not the repeating one. */
const dueToday = "Groceries: milk, eggs, oats";

/** Open Settings from the Lists menu, as a thumb would. */
async function openSettings(page: Page) {
  await press(page, page.getByRole("button", { name: "list menu" }));
  await press(page, page.getByRole("menuitem", { name: "Settings" }));
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

test("a fresh start lands on Today, and Today leads the strip", async ({
  page,
}) => {
  await page.goto("/");
  await expect(row(page, supplements)).toBeVisible();

  await expect(listTab(page, "Today")).toHaveAttribute("aria-selected", "true");
  await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "false");

  const today = await listTab(page, "Today").boundingBox();
  const main = await listTab(page, tabs.main).boundingBox();
  expect(today?.x ?? Number.NaN).toBeLessThan(main?.x ?? Number.NaN);
});

test("Today holds the due tasks and the past ones, in two groups", async ({
  page,
}) => {
  await page.goto("/");
  await expect(row(page, supplements)).toBeVisible();

  const pastHeader = sectionHeader(page, "Past");
  const todayHeader = sectionHeader(page, "Today");
  await expect(pastHeader).toBeVisible();
  await expect(todayHeader).toBeVisible();

  // The past group sits above the day's own rows.
  await expectAbove(pastHeader, todayHeader);
  await expectAbove(pastHeader, row(page, past));
  await expectAbove(todayHeader, row(page, supplements));
  await expectAbove(row(page, dueToday), row(page, supplements));

  // An undated task waits on Main. Today names no day for it.
  await expect(row(page, undated.second)).toHaveCount(0);
});

test("the sort control belongs to the list tabs, not to Today", async ({
  page,
}) => {
  await page.goto("/");
  await expect(row(page, supplements)).toBeVisible();
  await expect(page.getByRole("button", { name: "sort list" })).toHaveCount(0);

  await press(page, listTab(page, tabs.main));
  await expect(page.getByRole("button", { name: "sort list" })).toBeVisible();
});

test("a tick leaves Today and writes its completion", async ({ page }) => {
  await page.goto("/");
  await expect(row(page, supplements)).toBeVisible();

  await press(page, row(page, supplements).getByRole("checkbox"));

  await expect(row(page, supplements)).toHaveCount(0);
  await expect.poll(() => noteText(page, supplementsTick.note)).toContain(
    supplementsTick.completedPrefix,
  );
});

test("a capture on Today is due today", async ({ page }) => {
  await page.goto("/");
  await expect(row(page, supplements)).toBeVisible();

  const name = "Water the ferns";
  await press(page, page.getByRole("button", { name: "add task" }));
  await expect(
    page.getByRole("button", { name: "target list: Today" }),
  ).toBeVisible();
  await page.getByPlaceholder("Add a task").fill(name);
  await press(page, page.getByRole("button", { name: "send task" }));

  await expect.poll(() => noteText(page, `Tasks/${name}.md`)).toContain(
    "due: 2026-10-26",
  );
  // It writes no list, so the new task belongs to no list note.
  expect(await noteText(page, `Tasks/${name}.md`)).not.toContain("list:");
  await expect(row(page, name)).toBeVisible();
});

test.describe("Settings", () => {
  test("switches Today off and on, and the choice survives a reload", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(row(page, supplements)).toBeVisible();

    await openSettings(page);
    const today = page.getByRole("switch", { name: "Today" });
    await expect(today).toHaveAttribute("aria-checked", "true");
    await press(page, today);
    await expect(today).toHaveAttribute("aria-checked", "false");

    await page.goBack();
    await expect(page).toHaveURL("/");
    // Main leads again, and Today's tab is gone.
    await expect(listTab(page, "Today")).toHaveCount(0);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
    await expect(row(page, undated.second)).toBeVisible();

    await page.reload();
    await expect(row(page, undated.second)).toBeVisible();
    await expect(listTab(page, "Today")).toHaveCount(0);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");

    // Turn it back on, so the suite's other specs see the shipped
    // default.
    await openSettings(page);
    await press(page, page.getByRole("switch", { name: "Today" }));
    await page.goBack();
    await expect(listTab(page, "Today")).toHaveAttribute("aria-selected", "true");
  });

  test("a tab pick survives the Settings trip", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();

    await openSettings(page);
    await page.goBack();

    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
  });
});

test("Today survives a refresh of the vault read", async ({ page }) => {
  await page.goto("/");
  await expect(row(page, supplements)).toBeVisible();

  await returnToTab(page);

  await expect(listTab(page, "Today")).toHaveAttribute("aria-selected", "true");
  await expect(row(page, supplements)).toBeVisible();
});
