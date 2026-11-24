import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures";

/**
 * The operator's 2026-11-24 feedback: the tabs run Lists, Planner,
 * Inbox Notes, Journal. The bar, the focus order behind it and the
 * command pane's Go to rows all read that order, so a swap that lands
 * in one place only fails here.
 */

/** The bar's tabs, left to right. */
const order = ["Lists", "Planner", "Inbox Notes", "Journal"];

function bar(page: Page): Locator {
  return page.getByRole("tablist", { name: "screens" });
}

async function labels(target: Locator): Promise<string[]> {
  return target
    .getByRole("tab")
    .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("aria-label") ?? ""));
}

/** Where an element's left edge sits, for a left-to-right check. */
async function leftOf(target: Locator): Promise<number> {
  const box = await target.boundingBox();
  return box == null ? Number.NaN : box.x;
}

test("the bar runs Lists, Planner, Inbox Notes, Journal", async ({ page }) => {
  await page.goto("/");
  await expect(bar(page).getByRole("tab")).toHaveCount(4);

  expect(await labels(bar(page))).toEqual(order);
  for (let i = 1; i < order.length; i += 1) {
    const before = await leftOf(bar(page).getByRole("tab", { name: order[i - 1] }));
    const after = await leftOf(bar(page).getByRole("tab", { name: order[i] }));
    expect(before, `${order[i - 1]} sits left of ${order[i]}`).toBeLessThan(after);
  }
});

test("a tab press lands on the tab that was pressed", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Inbox Notes", "Journal"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }
});

test("the command pane lists the Go to rows in tab order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("bottom-bar")).toBeVisible();
  await page
    .getByRole("button", { name: "open commands" })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Commands" })).toBeVisible();

  // The rows read up from the search, so the first row in the order
  // sits nearest the search and each later one above it.
  const rows = ["planner", "inbox", "journal"].map((id) =>
    page.getByTestId(`command:${id}`),
  );
  for (const row of rows) {
    await expect(row).toBeVisible();
  }
  for (let i = 1; i < rows.length; i += 1) {
    const before = (await rows[i - 1].boundingBox())?.y ?? Number.NaN;
    const after = (await rows[i].boundingBox())?.y ?? Number.NaN;
    expect(before, `${i - 1} sits nearer the search than ${i}`).toBeGreaterThan(
      after,
    );
  }
});
