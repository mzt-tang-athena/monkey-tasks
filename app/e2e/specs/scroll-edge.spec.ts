import { expect, test } from "../fixtures";
import type { Page, Locator } from "@playwright/test";
import { rgb, setTheme } from "../theme";
import { THEMES, type ThemeName } from "../../src/theme/palettes";

/**
 * The ticket 20261119 hairline under a header (ADR 20261119). The day's
 * timeline grows its line once hours pass under the header. The Inbox
 * grid and the Settings screen keep theirs. The line sits on the top
 * edge of the scroller it marks, in the active palette's hairline.
 */

const palettes: ThemeName[] = ["budget", "midnight"];

async function opacity(edge: Locator): Promise<number> {
  return Number(await edge.evaluate((element) => getComputedStyle(element).opacity));
}

async function color(edge: Locator): Promise<string> {
  return edge.evaluate((element) => getComputedStyle(element).backgroundColor);
}

async function openInbox(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Inbox Notes", exact: true }).click();
  await expect(page.getByTestId("inbox-edge")).toHaveCount(1);
}

async function openSettings(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "list menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

/** The top of the box, in page order. */
async function topOf(target: Locator): Promise<number> {
  const box = await target.boundingBox();
  return box == null ? Number.NaN : box.y;
}

test("the timeline line shows once hours scroll under the header", async ({
  page,
}) => {
  await page.goto("/planner");
  const scroller = page.getByTestId("timeline-scroller");
  const edge = page.getByTestId("timeline-edge");
  const firstHour = page.getByTestId("timeline-hour:13");
  await expect(firstHour).toBeVisible();

  // A page at its top carries no line.
  await expect.poll(() => opacity(edge)).toBe(0);
  // The line sits on the scroller's own top edge, where the cut lands.
  expect(Math.abs((await topOf(edge)) - (await topOf(scroller)))).toBeLessThan(1);

  const before = await topOf(firstHour);
  await scroller.hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => topOf(firstHour)).toBeLessThan(before - 100);
  await expect.poll(() => opacity(edge)).toBe(1);

  await page.mouse.wheel(0, -600);
  await expect.poll(() => opacity(edge)).toBe(0);
});

test("the inbox line always shows under the title", async ({ page }) => {
  await openInbox(page);
  const edge = page.getByTestId("inbox-edge");
  await expect.poll(() => opacity(edge)).toBe(1);

  const header = page.getByTestId("inbox-header");
  const firstCard = page.getByTestId("note-card:202610260830.md");
  const edgeTop = await topOf(edge);
  expect(edgeTop).toBeGreaterThan(await topOf(header));
  // The line sits on the list's first row, where a scroll cuts it.
  expect(Math.abs(edgeTop - (await topOf(firstCard)))).toBeLessThan(1);
});

test("the settings line always shows under Back", async ({ page }) => {
  await openSettings(page);
  const edge = page.getByTestId("settings-edge");
  await expect.poll(() => opacity(edge)).toBe(1);

  const back = page.getByRole("button", { name: "back" });
  const title = page.getByRole("heading", { name: "Settings" });
  const edgeTop = await topOf(edge);
  expect(edgeTop).toBeGreaterThan(await topOf(back));
  expect(edgeTop).toBeLessThanOrEqual(await topOf(title));
});

for (const name of palettes) {
  test(`the lines take the ${name} hairline`, async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("timeline-scroller")).toBeVisible();
    await setTheme(page, name);
    await page.getByTestId("timeline-scroller").hover();
    await page.mouse.wheel(0, 240);
    const timeline = page.getByTestId("timeline-edge");
    await expect.poll(() => opacity(timeline)).toBe(1);
    await expect.poll(() => color(timeline)).toBe(rgb(THEMES[name].hairline));

    await openInbox(page);
    await expect.poll(() => color(page.getByTestId("inbox-edge"))).toBe(
      rgb(THEMES[name].hairline),
    );

    await openSettings(page);
    await expect.poll(() => color(page.getByTestId("settings-edge"))).toBe(
      rgb(THEMES[name].hairline),
    );
  });
}
