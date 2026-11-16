import { expect, test } from "../../../../app/e2e/fixtures";
import { rename, undated } from "../../../../app/e2e/data";
import { listTab, press, row } from "../../../../app/e2e/locators";
import {
  failNextWrite,
  noteText,
  notePaths,
  returnToTab,
} from "../../../../app/e2e/vault";

/**
 * The editor sheet end to end: a due with a time, a weekly repeat, a
 * list, a reminder and a note, all written as they are picked. Then a
 * failed write with Retry, and a delete with Undo that restores the
 * exact text.
 */

const path = `Tasks/${undated.second}.md`;

async function openEditor(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await press(
    page,
    row(page, undated.second).getByRole("button", { name: undated.second }),
  );
  const editor = page.getByRole("dialog", { name: "Task" });
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS("opacity", "1");
  return editor;
}

test("the editor writes each property as it is picked", async ({ page }, info) => {
  test.setTimeout(120_000);
  const shot = (name: string) =>
    page.screenshot({ path: info.outputPath(`${name}.png`) });

  const editor = await openEditor(page);
  await shot("01-sheet-at-rest");

  // A due with a time: tomorrow at 9:00 AM.
  await editor.getByRole("button", { name: "add due date" }).click();
  const due = page.getByRole("dialog", { name: "Due" });
  await expect(due).toBeVisible();
  await expect(due).toHaveCSS("opacity", "1");
  await shot("02-due-picker");
  await due.getByRole("button", { name: "Tomorrow" }).click();
  await due.getByRole("button", { name: "add a time" }).click();
  await expect(
    due.getByRole("button", { name: "done with the date" }),
  ).toBeVisible();
  // The time face grows the panel after a measure. Let it land.
  await page.waitForTimeout(300);
  await shot("03-due-picker-with-time");
  await due.getByRole("button", { name: "done with the date" }).click();
  await expect(due).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "change due date" })).toBeVisible();

  // A weekly repeat.
  await editor.getByRole("button", { name: "add repeat" }).click();
  const repeat = page.getByRole("dialog", { name: "Repeat" });
  await expect(repeat).toBeVisible();
  await expect(repeat).toHaveCSS("opacity", "1");
  await shot("04-repeat-picker");
  await repeat.getByRole("button", { name: /^Weekly/ }).click();
  await expect(repeat).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "change repeat" })).toBeVisible();

  // One list, from the header.
  await editor.getByRole("button", { name: "change list" }).click();
  const list = page.getByRole("dialog", { name: "List" });
  await expect(list).toBeVisible();
  await expect(list).toHaveCSS("opacity", "1");
  await shot("05-list-picker");
  await list.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(list).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "change list" })).toContainText(
    "Focus",
  );

  // A reminder, a day later.
  await editor.getByRole("button", { name: "add reminder" }).click();
  const alerts = page.getByRole("dialog", { name: "Alerts" });
  await expect(alerts).toBeVisible();
  await expect(alerts).toHaveCSS("opacity", "1");
  await alerts.getByRole("button", { name: "add reminder" }).click();
  await shot("06-alerts-picker");
  await alerts.getByRole("button", { name: "save reminder" }).click();
  await expect(
    alerts.getByRole("button", { name: /^remove reminder/ }),
  ).toHaveCount(1);
  await shot("06b-alert-added");
  // The scrim's close control sits in the sheet's own overlay.
  await page.getByRole("button", { name: "close alerts" }).click();
  await expect(alerts).toHaveCount(0);

  // A note.
  await editor.getByRole("button", { name: /^(add|edit) note$/ }).click();
  const note = page.getByRole("dialog", { name: "Note" });
  await expect(note).toBeVisible();
  await expect(note).toHaveCSS("opacity", "1");
  await note.getByRole("textbox", { name: "Note" }).fill("Ask about the boiler");
  await shot("07-note-editor");
  await note.getByRole("button", { name: "done with the note" }).click();
  await expect(note).toHaveCount(0);
  await expect(editor.getByText("Ask about the boiler")).toBeVisible();
  await shot("08-sheet-with-tiles");

  // A title, then close.
  await editor
    .getByRole("textbox", { name: "Task name" })
    .fill(rename.to);
  // Escape is Android back in the browser: it closes the sheet.
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);

  // The note holds every choice, and no raw syntax reached the sheet.
  const text = await noteText(page, `Tasks/${rename.to}.md`);
  expect(text).toContain("due: ");
  expect(text).toContain("T09:00");
  expect(text).toContain("recurrence: FREQ=WEEKLY");
  expect(text).toContain('list: "[[Focus]]"');
  expect(text).toMatch(/reminders:\n {2}- /);
  expect(text).toContain("Ask about the boiler");
  expect(text).not.toContain("lists:");
  await info.attach("note", { body: text ?? "", contentType: "text/plain" });

  await returnToTab(page);
  // The task took the Focus list, so it left Main for that tab.
  await listTab(page, "Focus").click();
  const moved = row(page, rename.to);
  await expect(moved).toBeVisible();
  await moved.scrollIntoViewIfNeeded();
  await shot("09-row-after-reread");
});

test("a failed write keeps the draft, and Retry saves it", async ({ page }, info) => {
  test.setTimeout(120_000);
  const shot = (name: string) =>
    page.screenshot({ path: info.outputPath(`${name}.png`) });

  const editor = await openEditor(page);
  await failNextWrite(page, `${undated.second}.md`);

  await editor.getByRole("button", { name: "add due date" }).click();
  const due = page.getByRole("dialog", { name: "Due" });
  await due.getByRole("button", { name: "Tomorrow" }).click();
  await due.getByRole("button", { name: "done with the date" }).click();

  const failed = page.getByRole("alert").filter({ hasText: "Not saved." });
  await expect(failed).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "change due date" }),
  ).toBeVisible();
  await shot("10-failed-row");

  await editor.getByRole("button", { name: "retry save" }).click();
  await expect(failed).toHaveCount(0);
  await expect
    .poll(() => noteText(page, path))
    .toContain("due: ");
  await shot("11-after-retry");
});

test("delete shows a toast, and Undo puts the exact text back", async ({ page }, info) => {
  test.setTimeout(120_000);
  const shot = (name: string) =>
    page.screenshot({ path: info.outputPath(`${name}.png`) });

  const editor = await openEditor(page);
  const before = await noteText(page, path);

  await editor.getByRole("button", { name: "task menu" }).click();
  const menu = page.getByRole("menu", { name: "Task menu" });
  await expect(menu).toBeVisible();
  await shot("12-task-menu");
  await menu.getByRole("menuitem", { name: "Delete" }).click();

  const toast = page.getByRole("alert").filter({ hasText: "Task deleted" });
  await expect(toast).toBeVisible();
  await expect(editor).toHaveCount(0);
  await expect(row(page, undated.second)).toHaveCount(0);
  expect(await noteText(page, path)).toBeNull();
  await shot("13-deleted-toast");

  await page.getByRole("button", { name: "undo delete" }).click();
  await expect.poll(() => noteText(page, path)).toBe(before);
  await expect(row(page, undated.second)).toBeVisible();
  expect(await notePaths(page, "Tasks/")).toContain(path);
  await shot("14-restored");

  await returnToTab(page);
  await expect(row(page, undated.second)).toBeVisible();
  expect(await noteText(page, path)).toBe(before);
});
