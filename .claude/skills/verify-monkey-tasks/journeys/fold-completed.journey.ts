import { expect, test } from "../../../../app/e2e/fixtures";
import { sections, undated } from "../../../../app/e2e/data";
import {
  closeCompleted,
  completedToggle,
  openCompleted,
  row,
  sectionHeader,
} from "../../../../app/e2e/locators";
import { notePaths, noteText } from "../../../../app/e2e/vault";

/**
 * Ticket 20261116: Completed folds by default, opens on a tap, and the
 * list menu clears the tab's done notes after a confirmation that names
 * the count. The evidence is a screenshot at each step and the note
 * list before and after.
 */

const doneNotes = ["Buy stamps", "Fix bike light", "Water the fern"];

test("fold and clear: a folded Completed opens, and the menu clears it", async ({
  page,
}, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: info.outputPath(`${name}.png`) });
  const notes = () => notePaths(page, "Tasks/");

  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await expect(completedToggle(page)).toHaveAccessibleName("Completed 3 tasks");
  await expect(completedToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(sectionHeader(page, sections.completed)).toBeVisible();
  for (const name of doneNotes) {
    await expect(row(page, name)).toHaveCount(0);
  }
  await shot("01-completed-folded");

  await openCompleted(page);
  for (const name of doneNotes) {
    await expect(row(page, name)).toBeVisible();
  }
  await shot("02-completed-open");

  await closeCompleted(page);
  await expect(row(page, doneNotes[0])).toHaveCount(0);
  await shot("03-completed-folded-again");

  const before = await notes();
  await info.attach("notes-before", {
    body: before.join("\n"),
    contentType: "text/plain",
  });

  await page.getByRole("button", { name: "list menu" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Delete all completed tasks" }),
  ).toBeVisible();
  await shot("04-menu-item");

  await page
    .getByRole("menuitem", { name: "Delete all completed tasks" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Delete completed tasks" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Delete 3 completed tasks?");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await shot("05-confirm");

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await notes(), "Cancel leaves every file").toEqual(before);
  await shot("06-cancelled");

  await page.getByRole("button", { name: "list menu" }).click();
  await page
    .getByRole("menuitem", { name: "Delete all completed tasks" })
    .click();
  await page.getByRole("dialog", { name: "Delete completed tasks" })
    .getByRole("button", { name: "Delete" })
    .click();

  for (const name of doneNotes) {
    await expect.poll(() => noteText(page, `Tasks/${name}.md`)).toBeNull();
  }
  await expect(completedToggle(page)).toHaveCount(0);
  await expect(row(page, undated.second)).toBeVisible();
  const after = await notes();
  info.attach("notes-after", {
    body: after.join("\n"),
    contentType: "text/plain",
  });
  for (const name of doneNotes) {
    expect(after, `${name}.md is gone`).not.toContain(`Tasks/${name}.md`);
  }
  expect(after.length, "three notes left the vault").toBe(before.length - 3);
  await shot("07-cleared");
});
