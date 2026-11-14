import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import type { Page } from "@playwright/test";
import { failNextWrite, noteText, putNote, returnToTab } from "../vault";

/**
 * The Journal tab on the web build: today's note, the composer, the
 * Food strip and the reference preview (tickets 0089 and 0090).
 */

const journalPath = "Journal/Daily/2026-10-26.md";
const embed = "\n\n![[daily.base]]\n";

async function openJournal(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Journal", exact: true }).click();
  await expect(page.getByTestId("journal-screen")).toBeVisible();
}

async function openComposer(page: Page) {
  await page.getByRole("button", { name: "add entry" }).click();
  await expect(page.getByRole("dialog", { name: "Write an entry" })).toBeVisible();
}

async function sendEntry(page: Page, text: string) {
  await openComposer(page);
  await page.getByPlaceholder(/What/).fill(text);
  await page.getByRole("button", { name: "send entry" }).click();
}

/** The note once it holds `text`. Reads race the write, so poll. */
async function expectNote(page: Page, text: string) {
  await expect.poll(() => noteText(page, journalPath)).toContain(text);
}

test("the bar opens today's note as a ruled page", async ({ page }) => {
  await openJournal(page);

  await expect(page.getByText("Monday 26")).toBeVisible();
  await expect(page.getByText("Woke up early, before the alarm")).toBeVisible();
  await expect(page.getByText("Went out for dessert with others")).toBeVisible();
  await expect(page.getByText("8:05", { exact: true })).toBeVisible();
  await expect(page.getByText("19:52", { exact: true })).toBeVisible();

  // A food bullet shows its prefix as a label and hides the marker.
  await expect(page.getByText("oatmeal", { exact: true })).toBeVisible();
  await expect(page.getByText("#food", { exact: true })).toHaveCount(0);
  await expect(page.getByText("#protein", { exact: true })).toBeVisible();
});

test("a sent entry lands above the embed and moves no earlier byte", async ({
  page,
}) => {
  await openJournal(page);
  const before = (await noteText(page, journalPath)) as string;
  expect(before.endsWith(embed)).toBe(true);
  const head = before.slice(0, -embed.length);

  await sendEntry(page, "Read two chapters\nMade soup");
  await expectNote(page, "Made soup");

  const after = (await noteText(page, journalPath)) as string;
  expect(after.startsWith(`${head}\n\n`)).toBe(true);
  expect(after).toMatch(
    new RegExp(
      `^${head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n\\n\\d{2}:\\d{2}\\n- Read two chapters\\n- Made soup\\n\\n!\\[\\[daily\\.base\\]\\]\\n$`,
    ),
  );
  await expect(page.getByText("Read two chapters")).toBeVisible();
  await expect(page.getByText("Made soup")).toBeVisible();
});

test("a food entry reaches the note and the Food strip", async ({ page }) => {
  await openJournal(page);
  await expect(page.getByTestId("food-strip")).toContainText("2");

  await openComposer(page);
  await page.getByRole("button", { name: "food entry: off" }).click();
  await expect(page.getByPlaceholder("What did you eat?")).toBeVisible();
  await page.getByPlaceholder("What did you eat?").fill("toast with jam");
  await page.getByRole("button", { name: "send entry" }).click();

  await expectNote(page, "- Ate: toast with jam #food");
  const strip = page.getByTestId("food-strip");
  await expect(strip).toContainText("3");
  await expect(strip).toContainText("toast with jam");
  await expect(
    page.getByLabel(/food today, 3 entries: .*toast with jam/),
  ).toBeVisible();
  await expect(page.getByText("toast with jam", { exact: true })).toBeVisible();
});

test("the first send creates the note on an empty vault", async ({ page }) => {
  await page.goto("/journal?vault=");
  await expect(page.getByTestId("journal-screen")).toBeVisible();
  await expect(page.getByText("Nothing written yet today.")).toBeVisible();
  await expect(page.getByTestId("food-strip")).toContainText("No food logged");

  await sendEntry(page, "the first entry");
  await expectNote(page, "the first entry");

  const text = await noteText(page, journalPath);
  expect(text).toMatch(/^\d{2}:\d{2}\n- the first entry\n$/);
});

test("a failed write keeps the draft and Retry lands it", async ({ page }) => {
  await openJournal(page);
  await failNextWrite(page, "2026-10-26.md");

  await sendEntry(page, "kept for retry");
  await expect(page.getByText(/Couldn't save the entry\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "retry entry" })).toBeVisible();

  await page.getByRole("button", { name: "retry entry" }).click();
  await expectNote(page, "- kept for retry");
  await expect
    .poll(
      async () =>
        (await noteText(page, journalPath))?.match(/- kept for retry/g)?.length,
    )
    .toBe(1);
});

test("a failed write leaves its draft in the composer", async ({ page }) => {
  await openJournal(page);
  await failNextWrite(page, "2026-10-26.md");

  await sendEntry(page, "still in the box");
  await expect(page.getByText(/Couldn't save the entry\./)).toBeVisible();

  await openComposer(page);
  await expect(page.getByPlaceholder("What happened?")).toHaveValue(
    "still in the box",
  );
});

test("an edit from another app survives the send", async ({ page }) => {
  await openJournal(page);
  const before = (await noteText(page, journalPath)) as string;
  const outside = before.replace(
    "Plan the weekend hike\n",
    "Plan the weekend hike\n\n20:30\n- Wrote this in Obsidian\n",
  );
  await putNote(page, journalPath, outside);
  await returnToTab(page);
  await expect(page.getByText("Wrote this in Obsidian")).toBeVisible();

  await sendEntry(page, "written by the app");
  await expectNote(page, "- written by the app");

  const after = (await noteText(page, journalPath)) as string;
  expect(after).toContain("Wrote this in Obsidian");
  expect(after.indexOf("Wrote this in Obsidian")).toBeLessThan(
    after.indexOf("written by the app"),
  );
});

test("a reference link opens its note, and a missing one says so", async ({
  page,
}) => {
  await openJournal(page);
  await page.getByRole("link", { name: "open reference oatmeal" }).click();
  const sheet = page.getByRole("dialog", { name: "Reference: oatmeal" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Rolled oats with milk and brown sugar.");
  await page.getByRole("button", { name: "close reference" }).click();
  await expect(sheet).toHaveCount(0);

  const before = (await noteText(page, journalPath)) as string;
  await putNote(
    page,
    journalPath,
    before.replace(
      "Plan the weekend hike\n",
      "Plan the weekend hike\n\n21:00\n- Ate: [[no-such-note]] #food\n",
    ),
  );
  await returnToTab(page);
  await page.getByRole("link", { name: "open reference no-such-note" }).click();
  await expect(
    page.getByRole("dialog", { name: "Reference: no-such-note" }),
  ).toContainText("That reference note is missing.");
});

test.describe("axe", () => {
  test("the journal page and its open composer", async ({ page }) => {
    await openJournal(page);
    await expect(page.getByText("Woke up early, before the alarm")).toBeVisible();
    const pageScan = await new AxeBuilder({ page }).analyze();
    expect(
      pageScan.violations.filter(
        (finding) => finding.impact === "serious" || finding.impact === "critical",
      ),
    ).toEqual([]);

    await openComposer(page);
    const sheet = page.getByRole("dialog", { name: "Write an entry" });
    await expect(sheet).toHaveCSS("opacity", "1");
    const sheetScan = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(
      sheetScan.violations.filter(
        (finding) => finding.impact === "serious" || finding.impact === "critical",
      ),
    ).toEqual([]);
  });
});
