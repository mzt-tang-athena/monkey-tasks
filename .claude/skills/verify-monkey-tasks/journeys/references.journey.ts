import { expect, test } from "../../../../app/e2e/fixtures";
import { references, undated } from "../../../../app/e2e/data";
import { press, row } from "../../../../app/e2e/locators";
import { smallTargets } from "../../../../app/e2e/targets";
import { noteText, putNote, returnToTab } from "../../../../app/e2e/vault";

/**
 * Reference notes on a task (ticket 0091): search by name and by
 * ingredient, attach two links, read one in the preview sheet, keep
 * them across a fresh vault read, then detach both. Each write is read
 * back from the note on disk. A link whose note is gone says so and
 * detaches. The capture sheet's link for a list target is here too.
 */

const path = references.path;

async function openEditor(
  page: import("@playwright/test").Page,
  fresh = true,
) {
  if (fresh) {
    await page.goto("/");
  }
  await expect(row(page, references.task)).toBeVisible();
  await press(
    page,
    row(page, references.task).getByRole("button", {
      name: new RegExp(`^${references.task}`),
    }),
  );
  const editor = page.getByRole("dialog", { name: "Task" });
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS("opacity", "1");
  return editor;
}

async function checkTargets(page: import("@playwright/test").Page, where: string) {
  expect(await smallTargets(page, '[role="dialog"]'), `${where} keeps 44pt`).toEqual(
    [],
  );
}

test("a reference is found, attached, read, kept and detached", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const shot = (name: string) =>
    page.screenshot({ path: info.outputPath(`${name}.png`) });

  const editor = await openEditor(page);
  const before = await noteText(page, path);
  expect(before).not.toBeNull();
  await checkTargets(page, "the editor with its chips");
  await shot("01-editor-with-reference-chip");

  await editor.getByRole("button", { name: "link a reference" }).click();
  const picker = page.getByRole("dialog", { name: "Reference" });
  await expect(picker).toBeVisible();
  await expect(picker).toHaveCSS("opacity", "1");
  await checkTargets(page, "the reference picker");
  await shot("02-picker-before-typing");

  // The name search finds the note by its file name.
  const find = picker.getByRole("textbox", { name: "Find a reference" });
  await find.fill("egg");
  await expect(
    picker.getByRole("button", { name: `${references.eggs}, physical, recipes` }),
  ).toBeVisible();
  await shot("03-picker-by-name");

  // An ingredient alone finds the other note.
  await find.fill(references.ingredient);
  const oatmeal = picker.getByRole("button", {
    name: `${references.oatmeal}, physical, recipes`,
  });
  await expect(oatmeal).toBeVisible();
  await shot("04-picker-by-ingredient");
  await oatmeal.click();
  await expect
    .poll(() => noteText(page, path))
    .toContain(`[[${references.oatmeal}]]`);
  await find.fill("egg");
  await picker
    .getByRole("button", { name: `${references.eggs}, physical, recipes` })
    .click();
  await expect
    .poll(() => noteText(page, path))
    .toContain(`[[${references.oatmeal}]]\n[[${references.eggs}]]`);
  await find.fill("");
  await shot("05-picker-both-linked");

  // The whole folder for a finger that does not type.
  await picker
    .getByRole("button", { name: "browse the References folder" })
    .click();
  await expect(
    picker.getByRole("button", { name: `${references.oatmeal}, physical, recipes` }),
  ).toBeVisible();
  await shot("06-picker-browse");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(picker).toHaveCount(0);

  const attached = await noteText(page, path);
  await info.attach("note-after-attach", {
    body: attached ?? "",
    contentType: "text/plain",
  });
  expect(attached).toBe(
    `${before}## Reference\n\n[[${references.oatmeal}]]\n[[${references.eggs}]]\n`,
  );

  // The tile holds both links, and a press reads one.
  await expect(
    editor.getByRole("button", { name: `open reference ${references.eggs}` }),
  ).toBeVisible();
  await checkTargets(page, "the editor with its reference tile");
  await shot("07-editor-with-tile");
  await editor
    .getByRole("button", { name: `open reference ${references.eggs}` })
    .click();
  const preview = page.getByRole("dialog", { name: "Reference" });
  await expect(preview).toBeVisible();
  await expect(preview).toHaveCSS("opacity", "1");
  await expect(preview.getByText("Steamed eggs with a splash of soy.")).toBeVisible();
  await checkTargets(page, "the preview sheet");
  await shot("08-preview");
  await page.getByRole("button", { name: "close the reference" }).click();
  await expect(preview).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
    )
    .toBe(`open reference ${references.eggs}`);

  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);

  // A fresh vault read keeps both links on the row.
  await returnToTab(page);
  await expect(
    row(page, references.task).getByText(
      `${references.oatmeal}, ${references.eggs}`,
    ),
  ).toBeVisible();
  await shot("09-row-after-reread");
  expect(await noteText(page, path)).toBe(attached);

  // The editor shows them again, and detaches both, one line each.
  const again = await openEditor(page, false);
  await again
    .getByRole("button", { name: `remove reference ${references.eggs}` })
    .click();
  await expect
    .poll(() => noteText(page, path))
    .not.toContain(`[[${references.eggs}]]`);
  await shot("10-one-link-left");
  await again
    .getByRole("button", { name: `remove reference ${references.oatmeal}` })
    .click();
  await expect.poll(() => noteText(page, path)).not.toContain("## Reference");
  const detached = await noteText(page, path);
  await info.attach("note-after-detach", {
    body: detached ?? "",
    contentType: "text/plain",
  });
  expect(detached).toBe(before);
  await shot("11-detached");
});

test("a missing note says so and detaches", async ({ page }, info) => {
  test.setTimeout(120_000);
  const shot = (name: string) =>
    page.screenshot({ path: info.outputPath(`${name}.png`) });

  await page.goto("/");
  await expect(row(page, references.task)).toBeVisible();
  const before = (await noteText(page, path)) ?? "";
  await putNote(
    page,
    path,
    `${before}\n## Reference\n\n[[${references.missing}]]\n`,
  );
  await returnToTab(page);
  await expect(row(page, references.task)).toBeVisible();

  await press(
    page,
    row(page, references.task).getByRole("button", {
      name: new RegExp(`^${references.task}`),
    }),
  );
  await page
    .getByRole("button", { name: `open reference ${references.missing}` })
    .click();
  await expect(
    page.getByText(
      "That note is not in the References folder. It may have been renamed or deleted.",
    ),
  ).toBeVisible();
  await checkTargets(page, "the missing reference sheet");
  await shot("12-missing-note");

  await page
    .getByRole("button", { name: "detach the missing reference" })
    .click();
  await expect.poll(() => noteText(page, path)).not.toContain("## Reference");
  await shot("13-missing-detached");
});

test("a capture that lands on a list links a reference", async ({ page }, info) => {
  test.setTimeout(120_000);
  const shot = (name: string) =>
    page.screenshot({ path: info.outputPath(`${name}.png`) });

  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await page.getByRole("button", { name: "add task" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a task" });
  await expect(sheet).toBeVisible();

  // The pill starts on Main, which offers no link. One press reaches a
  // list, and the link control shows.
  const pill = page.getByRole("button", { name: /^target list: / });
  const start = await pill.getAttribute("aria-label");
  if (start === "target list: Main") {
    await pill.click();
  }
  await expect(
    page.getByRole("button", { name: "link a reference" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "link a reference" }).click();
  const picker = page.getByRole("dialog", { name: "Reference" });
  await expect(picker).toBeVisible();
  await picker.getByRole("textbox", { name: "Find a reference" }).fill("oats");
  await picker
    .getByRole("button", { name: `${references.oatmeal}, physical, recipes` })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `remove reference ${references.oatmeal}` }),
  ).toBeVisible();
  const target =
    (await page
      .getByRole("button", { name: /^target list: / })
      .getAttribute("aria-label"))?.replace("target list: ", "") ?? "Main";
  await shot("14-capture-with-link");

  const name = "Pick up oat milk";
  await sheet.getByPlaceholder("Add a task").fill(name);
  await page.getByRole("button", { name: "send task" }).click();
  await expect(page.getByRole("dialog", { name: "Add a task" })).toHaveCount(0);

  const note = `Tasks/${name}.md`;
  await expect.poll(() => noteText(page, note)).toContain(`[[${references.oatmeal}]]`);
  const text = await noteText(page, note);
  await info.attach("captured-note", {
    body: text ?? "",
    contentType: "text/plain",
  });
  expect(text).toContain(`## Reference\n\n[[${references.oatmeal}]]`);
  expect(text).toContain('list: "');
  // The captured note lands on the list tab the pill named.
  if (target !== "Main") {
    await page.getByRole("tab", { name: target }).click();
  }
  await expect(row(page, name).getByText(references.oatmeal)).toBeVisible();
  await shot("15-captured-row");
});
