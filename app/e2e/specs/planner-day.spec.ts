import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";

/**
 * Ticket 0072: the planner keeps the day the user picked for as long
 * as the app runs. Every way into the tab that names no day, the bar's
 * Planner item and the command pane, opens on that day, not today.
 */

const picked = "Wed 28";
const pickedHeading = "Wednesday 28";
const todayHeading = "Monday 26";

/** The screen's path with no query, so either way of naming the day
    passes this. */
function pathname(page: Page): string {
  return new URL(page.url()).pathname;
}

test("the planner keeps its picked day across a round trip through every tab", async ({
  page,
}) => {
  await page.goto("/planner");
  const heading = page.getByTestId("day-heading");
  await expect(heading).toContainText(todayHeading);

  await page.getByRole("tab", { name: picked, exact: true }).click();
  await expect(heading).toContainText(pickedHeading);

  const tabs = [
    ["Lists", "/"],
    ["Journal", "/journal"],
    ["Inbox Notes", "/inbox"],
  ] as const;
  for (const [tab, path] of tabs) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect.poll(() => pathname(page)).toBe(path);

    await page.getByRole("tab", { name: "Planner", exact: true }).click();
    await expect.poll(() => pathname(page)).toBe("/planner");
    await expect(heading).toContainText(pickedHeading);
  }
});

test("the command pane's Planner command opens on the picked day", async ({
  page,
}) => {
  await page.goto("/planner");
  const heading = page.getByTestId("day-heading");
  await page.getByRole("tab", { name: picked, exact: true }).click();
  await expect(heading).toContainText(pickedHeading);

  await page.getByRole("tab", { name: "Lists", exact: true }).click();
  await expect.poll(() => pathname(page)).toBe("/");

  await page
    .getByRole("button", { name: "open commands" })
    .filter({ visible: true })
    .click();
  await page.getByTestId("command:planner").click();

  await expect.poll(() => pathname(page)).toBe("/planner");
  await expect(heading).toContainText(pickedHeading);
});
