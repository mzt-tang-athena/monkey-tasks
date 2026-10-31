import { expect, pauseClock, test } from "../fixtures";
import {
  colonCapture,
  outsideNote,
  sections,
  supplements,
  supplementsTick,
  undated,
} from "../data";
import { expectInSection, row, sectionHeader } from "../locators";
import { noteText, putNote, returnToTab, slowVaultAndFailWrite } from "../vault";

// The preview runs the same write path as the phone, on a memory vault
// (ticket 0051). These specs read the notes it writes.

test("a captured name with a colon keeps it after the vault is read again", async ({
  page,
}) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();

  await page.getByRole("button", { name: "add task" }).click();
  await page.getByPlaceholder("Add a task").fill(colonCapture.typed);
  await page.getByRole("button", { name: "send task" }).click();
  await expect(row(page, colonCapture.typed)).toBeVisible();
  await expect.poll(() => noteText(page, colonCapture.note)).toContain(
    colonCapture.title,
  );

  // Another app adds a note, and the return to the tab reads the vault.
  // That note's row shows only once the read has landed.
  await putNote(page, outsideNote.path, outsideNote.text);
  await returnToTab(page);
  await expect(row(page, outsideNote.name)).toBeVisible();

  await expect(row(page, colonCapture.typed)).toBeVisible();
});

test("a tick on a repeating task makes its next occurrence a note", async ({
  page,
}) => {
  await page.goto("/");
  await expect(row(page, supplements)).toHaveCount(1);

  await row(page, supplements).getByRole("button", { name: "mark done" }).click();

  // The next occurrence is its own note, linked to this one (ADR 0027).
  await expect.poll(() => noteText(page, supplementsTick.next)).toContain(
    'recurrence previous: "[[Supplements]]"',
  );
  expect(await noteText(page, supplementsTick.next)).toContain(
    `due: ${supplementsTick.nextDue}`,
  );
  expect(await noteText(page, supplementsTick.note)).toContain(
    `completed: ${supplementsTick.completed}`,
  );
  // Today's row moves to Completed. The next one waits for its day, so
  // the list shows it tomorrow, not now.
  const done = row(page, supplements);
  await expect(done).toHaveCount(1);
  await expect(done.getByRole("button", { name: "mark not done" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expectInSection(done, sectionHeader(page, sections.completed));
});

test.describe("a slow vault and a failed write", () => {
  const latencyMs = 300;
  const name = undated.second;
  const fileName = `${name}.md`;
  const note = `Tasks/${fileName}`;

  for (const from of ["the page query", "globalThis.__vault"] as const) {
    test(`tick at once and roll back, set from ${from}`, async ({ page }) => {
      if (from === "the page query") {
        await page.goto(
          `/?latency=${latencyMs}&fail=${encodeURIComponent(`write:${fileName}`)}`,
        );
        await expect(row(page, name)).toBeVisible();
      } else {
        await page.goto("/");
        await expect(row(page, name)).toBeVisible();
        await slowVaultAndFailWrite(page, latencyMs, fileName);
      }
      const target = row(page, name);

      // With the clock stopped, the vault call waits until the test
      // moves the clock on. A short step lets the row render.
      await pauseClock(page);
      await target.getByRole("button", { name: "mark done" }).click();
      await page.clock.runFor(50);

      await expect(
        target.getByRole("button", { name: "mark not done" }),
        "the row ticks before the slow vault answers",
      ).toHaveAttribute("aria-checked", "true");
      expect(await noteText(page, note)).not.toContain("completed:");

      await page.clock.runFor(latencyMs * 4);
      await page.clock.resume();

      await expect(page.getByText(`write failed: ${fileName}`)).toBeVisible();
      await expect(
        target.getByRole("button", { name: "mark done" }),
        "the failed write rolls the tick back",
      ).toHaveAttribute("aria-checked", "false");
      expect(await noteText(page, note)).not.toContain("completed:");
    });
  }
});
