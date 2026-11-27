import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { capture, references, undated } from "../data";
import { openMain, press, row } from "../locators";
import { smallTargets } from "../targets";

// The capture sheet's controls (ticket 20261126-capture-controls-redesign):
// the list switcher and the reference control share one row with Send,
// every press target keeps 44 by 44, and Send draws a glyph.

async function openCaptureOnList(page: Page) {
  await page.goto("/");
  await openMain(page);
  await expect(row(page, undated.second)).toBeVisible();
  await page.getByRole("button", { name: "add task" }).click();
  await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
  const link = page.getByRole("button", { name: "link a reference" });
  for (let step = 0; step < 6 && !(await link.isVisible()); step++) {
    await press(page, page.getByRole("button", { name: /^target list: / }));
  }
  await expect(link).toBeVisible();
}

async function centerY(target: Locator) {
  const box = await target.boundingBox();
  expect(box, "control is on screen").not.toBeNull();
  return box!.y + box!.height / 2;
}

/** The sheet slides in, so a box read mid-entrance lands a few points
    off. The row is level once the sheet rests. */
async function expectLevel(a: Locator, b: Locator, what: string) {
  await expect
    .poll(async () => Math.abs((await centerY(a)) - (await centerY(b))), { message: what })
    .toBeLessThan(0.5);
}

test("the list, reference and send controls share one row", async ({ page }) => {
  await openCaptureOnList(page);
  const list = page.getByRole("button", { name: /^target list: / });
  const link = page.getByRole("button", { name: "link a reference" });
  const send = page.getByRole("button", { name: "send task" });

  const listBox = (await list.boundingBox())!;
  const linkBox = (await link.boundingBox())!;
  expect(linkBox.x, "the reference control follows the list control").toBeGreaterThanOrEqual(
    listBox.x + listBox.width,
  );
  await expectLevel(link, list, "the reference control sits level with the list control");
  await expectLevel(send, list, "send sits level with the list control");
});

test("an attached reference joins the same row", async ({ page }) => {
  await openCaptureOnList(page);
  const input = page.getByPlaceholder("Add a task");
  await input.fill(capture.typed);
  await page.getByRole("button", { name: "link a reference" }).click();
  const picker = page.getByRole("dialog", { name: "Reference" });
  await picker.getByRole("textbox", { name: "Find a reference" }).fill("oats");
  await press(
    page,
    picker.getByRole("button", {
      name: `${references.oatmeal}, physical, recipes`,
    }),
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();

  const chip = page.getByRole("button", {
    name: `remove reference ${references.oatmeal}`,
  });
  await expect(chip).toBeVisible();
  const list = page.getByRole("button", { name: /^target list: / });
  await expectLevel(chip, list, "the attached reference sits level with the list control");
});

test("every capture control keeps a 44 by 44 target and send draws a glyph", async ({
  page,
}) => {
  await openCaptureOnList(page);
  await page.getByPlaceholder("Add a task").fill(capture.typed);

  expect(await smallTargets(page, '[role="dialog"]')).toEqual([]);
  await expect(
    page.getByRole("button", { name: "send task" }).getByTestId("icon:arrow-up"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "send task" })).not.toContainText("↑");
});
