import { AxeBuilder } from "@axe-core/playwright";
import { expect, pauseClock, test } from "../fixtures";
import type { Page } from "@playwright/test";
import {
  failNextCreate,
  notePaths,
  noteText,
  putNote,
  returnToTab,
} from "../vault";

/**
 * The Inbox Notes tab (ticket 0095): the card grid, the fast capture,
 * the body-only editor, the read-check-write guard and the empty state.
 */

const today = "Inbox/202610260830.md";
const plain = "Inbox/declarative-vault-port.md";
const paste = "Inbox/20261022-indented-paste.md";

async function openInbox(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Inbox Notes", exact: true }).click();
  await expect(page.getByTestId(`note-card:${today.replace("Inbox/", "")}`)).toBeVisible();
}

/** The local stamp at the page clock, after the clock is paused. */
function stampNow(page: Page): Promise<string> {
  return page.evaluate(() => {
    const date = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(
      date.getHours(),
    )}${pad(date.getMinutes())}`;
  });
}

async function openComposer(page: Page) {
  await page.getByRole("button", { name: "add note" }).click();
  await expect(page.getByRole("dialog", { name: "New note" })).toBeVisible();
}

async function sendNote(page: Page, body: string) {
  await openComposer(page);
  await page.getByLabel("note text").fill(body);
  await page.getByRole("button", { name: "save note" }).click();
}

test("the cards show the names, the previews and two columns", async ({
  page,
}) => {
  await openInbox(page);

  const first = page.getByTestId("note-card:202610260830.md");
  const second = page.getByTestId("note-card:202610251945.md");
  const third = page.getByTestId("note-card:20261024-1830-thought-dump.md");
  await expect(first).toContainText("26 Oct 2026, 08:30");
  await expect(second).toContainText("25 Oct 2026, 19:45");
  await expect(third).toContainText("20261024-1830-thought-dump");
  await expect(page.getByTestId("note-card:20261023-flight-email-tracker.md")).toContainText(
    "20261023-flight-email-tracker",
  );

  // The frontmatter is skipped and the marks are gone.
  await expect(second).toContainText("Two books to find");
  await expect(second).not.toContainText("kind:");
  // The indented paste reads as prose, not as code.
  await expect(page.getByTestId(`note-card:${paste.replace("Inbox/", "")}`)).toContainText(
    "Slide 1",
  );

  const [a, b, c] = await Promise.all([
    first.boundingBox(),
    second.boundingBox(),
    third.boundingBox(),
  ]);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(c).not.toBeNull();
  // Two cards share a row; the third starts the next one.
  expect(Math.round(a!.y)).toBe(Math.round(b!.y));
  expect(a!.x).toBeLessThan(b!.x);
  expect(c!.y).toBeGreaterThan(a!.y);
});

test("a capture writes a stamped note with no frontmatter", async ({ page }) => {
  await openInbox(page);
  await pauseClock(page);
  const stamp = await stampNow(page);

  await sendNote(page, "A quick thought.");

  const card = page.getByTestId(`note-card:${stamp}.md`);
  await expect(card).toBeVisible();
  expect(await noteText(page, `Inbox/${stamp}.md`)).toBe("A quick thought.");
});

test("a typed title adds a kebab slug to the name", async ({ page }) => {
  await openInbox(page);
  await pauseClock(page);
  const stamp = await stampNow(page);

  await openComposer(page);
  await page.getByRole("button", { name: "add a title" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Buy stamps");
  await page.getByLabel("note text").fill("two books");
  await page.getByRole("button", { name: "save note" }).click();

  await expect(page.getByTestId(`note-card:${stamp}-buy-stamps.md`)).toBeVisible();
  expect(await noteText(page, `Inbox/${stamp}-buy-stamps.md`)).toBe("two books");
});

test("two captures in one minute keep both notes", async ({ page }) => {
  await openInbox(page);
  await pauseClock(page);
  const stamp = await stampNow(page);

  await sendNote(page, "one");
  await sendNote(page, "two");

  await expect(page.getByTestId(`note-card:${stamp}.md`)).toBeVisible();
  const second = page.getByTestId(`note-card:${stamp} (1).md`);
  await expect(second).toBeVisible();
  await expect(second).toContainText("(1)");
  expect(await noteText(page, `Inbox/${stamp} (1).md`)).toBe("two");
});

test("a failed capture keeps the draft and sends again", async ({ page }) => {
  await openInbox(page);
  await pauseClock(page);
  const stamp = await stampNow(page);
  await failNextCreate(page, `${stamp}.md`);

  await sendNote(page, "still here");

  await expect(page.getByRole("alert")).toContainText("create");
  await openComposer(page);
  await expect(page.getByLabel("note text")).toHaveValue("still here");
  await page.getByRole("button", { name: "save note" }).click();

  await expect(page.getByTestId(`note-card:${stamp}.md`)).toBeVisible();
  expect(await noteText(page, `Inbox/${stamp}.md`)).toBe("still here");
});

test("the first capture makes the Inbox folder", async ({ page }) => {
  await page.goto("/?vault=default");
  await page.getByRole("tab", { name: "Inbox Notes", exact: true }).click();
  await expect(
    page.getByText("No notes yet. The first note makes the Inbox folder."),
  ).toBeVisible();

  await sendNote(page, "the first one");

  await expect(page.getByText("No notes yet.")).toHaveCount(0);
  expect(await notePaths(page, "Inbox/")).not.toEqual([]);
});

test("open and save keeps the frontmatter byte for byte", async ({ page }) => {
  await openInbox(page);
  const before = (await noteText(page, plain)) as string;

  await page.getByTestId("note-card:declarative-vault-port.md").click();
  await expect(page.getByLabel("note body")).toHaveValue(
    /Declarative vault architecture/,
  );
  await page.getByLabel("note body").fill("Edited in the app.");
  await page.getByRole("button", { name: "save note" }).click();

  await expect(
    page.getByTestId("note-card:declarative-vault-port.md"),
  ).toContainText("Edited in the app.");
  const after = (await noteText(page, plain)) as string;
  expect(after.startsWith("---\nkind: resource\ncreated: 2026-09-24\n---\n")).toBe(
    true,
  );
  expect(after).toContain("Edited in the app.");
  expect(after.length).toBeGreaterThan(before.length - 100);
});

test("a conflict keeps the outside text, and a copy keeps the draft", async ({
  page,
}) => {
  await openInbox(page);
  await page.getByTestId("note-card:declarative-vault-port.md").click();
  await expect(page.getByLabel("note body")).toBeVisible();

  await putNote(page, plain, "changed by another app\n");
  await page.getByLabel("note body").fill("my draft");
  await page.getByRole("button", { name: "save note" }).click();

  await expect(page.getByText("This note changed")).toBeVisible();
  expect(await noteText(page, plain)).toBe("changed by another app\n");
  await page.getByRole("button", { name: /save a copy/i }).click();

  const copies = (await notePaths(page, "Inbox/")).filter(
    (path) => path !== plain && /\/\d{12}\.md$/.test(path),
  );
  expect(copies).toHaveLength(1);
  expect(await noteText(page, copies[0])).toBe("my draft");
});

test("a foreground read picks up an outside note", async ({ page }) => {
  await openInbox(page);
  const path = "Inbox/202610210700.md";
  await putNote(page, path, "from another app");
  await returnToTab(page);
  await expect(page.getByTestId("note-card:202610210700.md")).toBeVisible();
});

test("the screen, the composer and the editor pass axe", async ({ page }) => {
  const serious = (result: Awaited<ReturnType<AxeBuilder["analyze"]>>) =>
    result.violations.filter(
      (finding) =>
        finding.impact === "serious" || finding.impact === "critical",
    );
  const scan = async (where: string, include?: string) => {
    const builder = new AxeBuilder({ page });
    if (include != null) {
      builder.include(include);
    }
    expect(serious(await builder.analyze()), where).toEqual([]);
  };

  await openInbox(page);
  await scan("inbox screen");

  await openComposer(page);
  await expect(page.getByRole("dialog", { name: "New note" })).toHaveCSS(
    "opacity",
    "1",
  );
  await scan("inbox composer", '[role="dialog"]');
  await page.keyboard.press("Escape");

  await page.getByTestId("note-card:declarative-vault-port.md").click();
  await expect(page.getByLabel("note body")).toBeVisible();
  await scan("inbox editor");
});
