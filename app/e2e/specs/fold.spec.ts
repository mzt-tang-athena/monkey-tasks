import { expect, test } from "../fixtures";
import { sections, tabs, undated } from "../data";
import {
  closeCompleted,
  completedToggle,
  listTab,
  openCompleted,
  row,
  sectionHeader,
} from "../locators";
import { notePaths, noteText, putNote, returnToTab } from "../vault";

/**
 * Ticket 20261116: the Completed group folds by default and the list
 * menu clears the completed notes of the tab it opened from.
 */

/** The sample notes that are already done, all on Main. */
const doneNotes = ["Buy stamps", "Fix bike light", "Water the fern"];

/** A done note filed on the Errands tab. */
const ERRANDS_DONE = "Tasks/Pack lunch.md";
const ERRANDS_DONE_TEXT = [
  "---",
  'kind: "[[tasks]]"',
  "created: 2026-10-20",
  "completed: 2026-10-25",
  'list: "[[Errands]]"',
  "---",
  "",
  "Sandwich and an apple.",
  "",
].join("\n");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
});

test("Completed starts folded with its count, and opens and closes", async ({
  page,
}) => {
  const toggle = completedToggle(page);
  await expect(toggle).toHaveAccessibleName("Completed 3 tasks");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sectionHeader(page, sections.completed)).toBeVisible();
  for (const name of doneNotes) {
    await expect(row(page, name)).toHaveCount(0);
  }

  await openCompleted(page);
  for (const name of doneNotes) {
    await expect(row(page, name)).toBeVisible();
  }

  await closeCompleted(page);
  for (const name of doneNotes) {
    await expect(row(page, name)).toHaveCount(0);
  }
});

test("the fold is per tab and folded again on a fresh page", async ({ page }) => {
  await openCompleted(page);

  await listTab(page, tabs.next).click();
  await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
  await expect(completedToggle(page)).toHaveCount(0);

  await listTab(page, tabs.main).click();
  await expect(completedToggle(page)).toHaveAttribute("aria-expanded", "true");

  await page.reload();
  await expect(row(page, undated.second)).toBeVisible();
  await expect(completedToggle(page)).toHaveAttribute("aria-expanded", "false");
});

test("Cancel changes nothing", async ({ page }) => {
  const before = await notePaths(page, "Tasks/");
  await page.getByRole("button", { name: "list menu" }).click();
  await page
    .getByRole("menuitem", { name: "Delete all completed tasks" })
    .click();

  const dialog = page.getByRole("dialog", { name: "Delete completed tasks" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Delete 3 completed tasks?");
  await expect(dialog).toContainText("This removes their notes from the vault.");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  expect(await notePaths(page, "Tasks/")).toEqual(before);
  for (const name of doneNotes) {
    await expect.poll(() => noteText(page, `Tasks/${name}.md`)).not.toBeNull();
  }
});

test("the confirm removes exactly the completed notes of its tab", async ({
  page,
}) => {
  await putNote(page, ERRANDS_DONE, ERRANDS_DONE_TEXT);
  await returnToTab(page);
  await listTab(page, tabs.next).click();
  await expect(completedToggle(page)).toHaveAccessibleName("Completed 1 task");

  await page.getByRole("button", { name: "list menu" }).click();
  await page
    .getByRole("menuitem", { name: "Delete all completed tasks" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Delete completed tasks" });
  await expect(dialog).toContainText("Delete 1 completed task?");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog).toHaveCount(0);

  await expect.poll(() => noteText(page, ERRANDS_DONE)).toBeNull();
  await expect(completedToggle(page)).toHaveCount(0);

  await listTab(page, tabs.main).click();
  await expect(completedToggle(page)).toHaveAccessibleName("Completed 3 tasks");
  for (const name of doneNotes) {
    await expect.poll(() => noteText(page, `Tasks/${name}.md`)).not.toBeNull();
  }
  await expect(row(page, undated.second)).toBeVisible();
});
