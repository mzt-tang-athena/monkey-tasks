import { expect, test } from "../fixtures";
import type { Page } from "@playwright/test";
import { putNote, returnToTab } from "../vault";

/**
 * The Inbox header (tickets 20261126-inbox-one-column-view and
 * 20261126-inbox-search): a search bar with the view button inside it.
 * The view choice survives a reload. A search filters by title and body,
 * and clearing it restores every card.
 */

const cardPrefix = "note-card:";
const SAMPLE_NOTES = 7;

async function openInbox(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Inbox Notes", exact: true }).click();
  await expect(page.getByTestId("note-card:202610260830.md")).toBeVisible();
}

function cards(page: Page) {
  return page.locator(`[data-testid^="${cardPrefix}"]`);
}

function search(page: Page) {
  return page.getByRole("searchbox", { name: "search notes" });
}

async function rowOf(page: Page, fileName: string) {
  const box = await page.getByTestId(`${cardPrefix}${fileName}`).boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("the header names its search and its view button", async ({ page }) => {
  await openInbox(page);

  await expect(search(page)).toBeVisible();
  await expect(search(page)).toHaveAttribute("placeholder", "Search notes");
  await expect(
    page.getByRole("button", { name: "switch to one column" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Inbox Notes, 7 notes" }),
  ).toBeVisible();
});

test("the view button switches to one full-width column and back", async ({
  page,
}) => {
  await openInbox(page);
  const first = "202610260830.md";
  const second = "202610251945.md";

  const twoA = await rowOf(page, first);
  const twoB = await rowOf(page, second);
  expect(Math.round(twoA.y)).toBe(Math.round(twoB.y));

  await page.getByRole("button", { name: "switch to one column" }).click();
  await expect(
    page.getByRole("button", { name: "switch to two columns" }),
  ).toBeVisible();
  await expect(page.getByTestId(`${cardPrefix}${first}`)).toBeVisible();
  const oneA = await rowOf(page, first);
  const oneB = await rowOf(page, second);
  expect(oneB.y).toBeGreaterThan(oneA.y);
  expect(Math.round(oneA.x)).toBe(Math.round(oneB.x));
  expect(Math.round(oneA.width)).toBeGreaterThan(Math.round(twoA.width) * 1.8);

  await page.getByRole("button", { name: "switch to two columns" }).click();
  await expect(
    page.getByRole("button", { name: "switch to one column" }),
  ).toBeVisible();
  const backA = await rowOf(page, first);
  const backB = await rowOf(page, second);
  expect(Math.round(backA.y)).toBe(Math.round(backB.y));
});

test("a one column card shows more of a long note", async ({ page }) => {
  await openInbox(page);
  const lines = Array.from(
    { length: 6 },
    (_, line) => `Line ${line} of the long note keeps going for a while.`,
  ).join("\n");
  await putNote(page, "Inbox/202610270900.md", lines);
  await returnToTab(page);
  const card = page.getByTestId("note-card:202610270900.md");
  await expect(card).toBeVisible();
  await expect(card).not.toContainText("Line 5");

  await page.getByRole("button", { name: "switch to one column" }).click();
  await expect(card).toContainText("Line 5");
});

test("the view choice survives a restart", async ({ page }) => {
  await openInbox(page);
  await page.getByRole("button", { name: "switch to one column" }).click();
  await expect(
    page.getByRole("button", { name: "switch to two columns" }),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Inbox Notes", exact: true }).click();
  await expect(page.getByTestId("note-card:202610260830.md")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "switch to two columns" }),
  ).toBeVisible();
  const a = await rowOf(page, "202610260830.md");
  const b = await rowOf(page, "202610251945.md");
  expect(b.y).toBeGreaterThan(a.y);
});

test("a search filters by title and by body, and clearing restores", async ({
  page,
}) => {
  await openInbox(page);
  await expect(cards(page)).toHaveCount(SAMPLE_NOTES);

  // A body word. The note's name carries none of it.
  await search(page).fill("atlas");
  await expect(cards(page)).toHaveCount(1);
  await expect(page.getByTestId("note-card:202610251945.md")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Inbox Notes, 1 of 7 notes" }),
  ).toBeVisible();

  // A title word. The body carries none of it.
  await search(page).fill("declarative");
  await expect(cards(page)).toHaveCount(1);
  await expect(
    page.getByTestId("note-card:declarative-vault-port.md"),
  ).toBeVisible();

  // Case never matters and every word has to match.
  await search(page).fill("TRACK refund");
  await expect(cards(page)).toHaveCount(1);
  await expect(
    page.getByTestId("note-card:20261023-flight-email-tracker.md"),
  ).toBeVisible();
  await search(page).fill("track nothing");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText('No notes match "track nothing".')).toBeVisible();

  await page.getByRole("button", { name: "clear search" }).click();
  await expect(search(page)).toHaveValue("");
  await expect(cards(page)).toHaveCount(SAMPLE_NOTES);
  await expect(
    page.getByRole("heading", { name: "Inbox Notes, 7 notes" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "clear search" })).toHaveCount(0);

  await search(page).fill("atlas");
  await expect(cards(page)).toHaveCount(1);
  await search(page).fill("");
  await expect(cards(page)).toHaveCount(SAMPLE_NOTES);
});

test("a search reaches words past the card's preview", async ({ page }) => {
  await openInbox(page);
  const lines = [
    ...Array.from({ length: 12 }, (_, line) => `Filler line ${line}.`),
    "The hidden zebracrossing sits at the very end.",
  ].join("\n");
  await putNote(page, "Inbox/202610270900.md", lines);
  await returnToTab(page);
  const card = page.getByTestId("note-card:202610270900.md");
  await expect(card).toBeVisible();
  await expect(card).not.toContainText("zebracrossing");

  await search(page).fill("zebracrossing");
  await expect(cards(page)).toHaveCount(1);
  await expect(card).toBeVisible();
});

test("a search holds in one column and a card still opens", async ({
  page,
}) => {
  await openInbox(page);
  await page.getByRole("button", { name: "switch to one column" }).click();
  await search(page).fill("coffee");
  await expect(cards(page)).toHaveCount(1);

  await cards(page).first().click();
  await expect(page.getByLabel("note body")).toHaveValue(
    /^Coffee with Sam\. Bring the notebook\./,
  );
});
