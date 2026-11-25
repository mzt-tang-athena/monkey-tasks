import { expect, test } from "../fixtures";

/**
 * The Inbox Notes tab draws no title (ticket 20261125-inbox-drops-its-title).
 * The count stays as a small line, and it is also the screen's heading, so
 * a screen reader still names the screen.
 */

test("the Inbox tab shows no title and the screen keeps its name", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Inbox Notes", exact: true }).click();
  const screen = page.getByTestId("inbox-notes-screen");
  await expect(screen).toBeVisible();
  const header = page.getByTestId("inbox-header");
  await expect(header).toHaveText(/^\d+ notes?$/);

  await expect(screen.getByText("Inbox Notes", { exact: true })).toHaveCount(0);
  await expect(
    screen.getByRole("heading", { name: /^Inbox Notes, \d+ notes?$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Inbox Notes", exact: true }),
  ).toBeVisible();
});
