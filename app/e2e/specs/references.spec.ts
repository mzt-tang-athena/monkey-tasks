import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { references } from "../data";
import { press, row } from "../locators";
import { noteText, putNote, returnToTab } from "../vault";

// A task can point at a note in the References folder (ticket 0091).
// The link lives in the task body under `## Reference`, so Obsidian
// renders it and the app reads the same text.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(row(page, references.task)).toBeVisible();
});

/** Open the task in its sheet. The row's name carries any links. */
async function openTask(page: Page) {
  await press(
    page,
    row(page, references.task).getByRole("button", {
      name: new RegExp(`^${references.task}`),
    }),
  );
  await expect(page.getByRole("dialog", { name: "Task" })).toBeVisible();
}

/** The picker's search field. */
function search(page: Page) {
  return page.getByRole("textbox", { name: "Find a reference" });
}

test("a reference attaches, previews, survives a re-read and detaches", async ({
  page,
}) => {
  const before = await noteText(page, references.path);
  expect(before).not.toBeNull();
  await openTask(page);

  await press(page, page.getByRole("button", { name: "link a reference" }));
  await expect(page.getByRole("dialog", { name: "Reference" })).toBeVisible();

  // By name: the row names the note it will attach, with its words.
  await search(page).fill("egg");
  const eggs = page.getByRole("button", {
    name: `${references.eggs}, physical, recipes`,
  });
  await expect(eggs).toBeVisible();
  await press(page, eggs);
  await expect
    .poll(() => noteText(page, references.path))
    .toContain(`## Reference\n\n[[${references.eggs}]]\n`);

  // By an ingredient alone, and a second attach adds a line.
  await search(page).fill(references.ingredient);
  const oatmeal = page.getByRole("button", {
    name: `${references.oatmeal}, physical, recipes`,
  });
  await expect(oatmeal).toBeVisible();
  await expect(page.getByText(references.words).first()).toBeVisible();
  await press(page, oatmeal);
  await expect
    .poll(() => noteText(page, references.path))
    .toContain(
      `## Reference\n\n[[${references.eggs}]]\n[[${references.oatmeal}]]\n`,
    );
  // Only the body changed: the note keeps its frontmatter as it was.
  const attached = (await noteText(page, references.path)) ?? "";
  expect(attached).toBe(
    `${before}## Reference\n\n[[${references.eggs}]]\n[[${references.oatmeal}]]\n`,
  );

  // The whole folder opens for a finger that does not type.
  await search(page).fill("");
  await press(
    page,
    page.getByRole("button", { name: "browse the References folder" }),
  );
  await expect(
    page.getByRole("button", { name: `${references.oatmeal}, physical, recipes` }),
  ).toBeVisible();
  await press(page, page.getByRole("button", { name: "Done", exact: true }));
  // The picker leaves the tree before the preview opens, so only one
  // dialog named Reference shows at a time.
  await expect(page.getByRole("dialog", { name: "Reference" })).toHaveCount(0);

  // The tile lists both links.
  await expect(
    page.getByRole("button", { name: `open reference ${references.eggs}` }),
  ).toBeVisible();

  // A tap on a link reads the note, and the close gives focus back.
  const opener = page.getByRole("button", {
    name: `open reference ${references.eggs}`,
  });
  await press(page, opener);
  await expect(page.getByRole("dialog", { name: "Reference" })).toBeVisible();
  await expect(
    page.getByText("Steamed eggs with a splash of soy."),
  ).toBeVisible();
  await press(page, page.getByRole("button", { name: "close the reference" }));
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-label")))
    .toBe(`open reference ${references.eggs}`);

  await press(page, page.getByRole("button", { name: "close the task" }));
  await expect(page.getByRole("dialog", { name: "Task" })).toHaveCount(0);

  // A fresh vault read keeps both links on the row.
  await returnToTab(page);
  const reopened = row(page, references.task);
  await expect(reopened.getByText(`${references.eggs}, ${references.oatmeal}`)).toBeVisible();
  await expect(
    reopened.getByRole("button", {
      name: `${references.task}, ${references.eggs}, ${references.oatmeal}`,
    }),
  ).toBeVisible();

  // The editor shows them again after that read, and detaches both.
  await openTask(page);
  await press(
    page,
    page.getByRole("button", { name: `remove reference ${references.eggs}` }),
  );
  await expect
    .poll(() => noteText(page, references.path))
    .not.toContain(`[[${references.eggs}]]`);
  await press(
    page,
    page.getByRole("button", { name: `remove reference ${references.oatmeal}` }),
  );

  await expect
    .poll(() => noteText(page, references.path))
    .not.toContain("## Reference");
  expect(await noteText(page, references.path)).toBe(before);
});

test("a link to a note that is not in the folder says so and detaches", async ({
  page,
}) => {
  const before = (await noteText(page, references.path)) ?? "";
  // Another app writes a link to a note that is not there.
  await putNote(
    page,
    references.path,
    `${before}\n## Reference\n\n[[${references.missing}]]\n`,
  );
  await returnToTab(page);
  // The linked word on the row proves the re-read reached the task, so
  // the sheet opens with the body this test just wrote.
  await expect(row(page, references.task)).toContainText(references.missing);
  await openTask(page);

  await press(
    page,
    page.getByRole("button", { name: `open reference ${references.missing}` }),
  );
  await expect(
    page.getByText(
      "That note is not in the References folder. It may have been renamed or deleted.",
    ),
  ).toBeVisible();

  await press(
    page,
    page.getByRole("button", { name: "detach the missing reference" }),
  );

  await expect
    .poll(() => noteText(page, references.path))
    .not.toContain("## Reference");
});
