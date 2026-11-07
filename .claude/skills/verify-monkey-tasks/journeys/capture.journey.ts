import { expect, test } from "../../../../app/e2e/fixtures";
import { capture, undated } from "../../../../app/e2e/data";
import { expectInSection, row, sectionHeader } from "../../../../app/e2e/locators";
import { noteText, returnToTab } from "../../../../app/e2e/vault";

const note = `Tasks/${capture.name}.md`;

test("capture: a typed task shows its parse, lands on its day, and writes its note", async ({
  page,
}, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: info.outputPath(`${name}.png`) });

  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await shot("01-lists-before");

  await page.getByRole("button", { name: "add task" }).click();
  await page.getByPlaceholder("Add a task").fill(capture.typed);
  await expect(page.getByText(capture.chipDay, { exact: true })).toBeVisible();
  await expect(page.getByText(capture.chipTime, { exact: true })).toBeVisible();
  await shot("02-sheet-with-chips");

  await page.getByRole("button", { name: "send task" }).click();
  const landed = row(page, capture.name);
  await expect(landed).toBeVisible();
  await expectInSection(
    landed,
    sectionHeader(page, capture.section),
    sectionHeader(page, capture.nextSection),
  );
  await landed.scrollIntoViewIfNeeded();
  await shot("03-row-landed");

  await expect.poll(() => noteText(page, note)).toContain("due: 2026-10-30");
  await info.attach("note", { body: (await noteText(page, note)) ?? "", contentType: "text/plain" });

  await returnToTab(page);
  await expect(landed).toBeVisible();
  await landed.scrollIntoViewIfNeeded();
  await shot("04-after-vault-reread");
});
