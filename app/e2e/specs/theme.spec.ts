import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { tomorrow, undated } from "../data";
import { press, row } from "../locators";
import { THEMES, type ThemeName } from "../../src/theme/palettes";

/**
 * Ticket 0083: the palette switches in place, and every palette holds
 * the same axe bar on every screen. The suite reaches the switch
 * through the same provider the phone uses, exposed as a test hook by
 * the exported web build.
 */

const names = Object.keys(THEMES) as ThemeName[];

/** jsdom and the browser report colors as rgb(); the palettes hold hex. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

async function setTheme(page: Page, name: ThemeName) {
  // The provider installs the hook on its first effect.
  await expect
    .poll(() =>
      page.evaluate(() => typeof (globalThis as { __setTheme?: unknown }).__setTheme),
    )
    .toBe("function");
  await page.evaluate((theme) => {
    const set = (globalThis as { __setTheme?: (next: string) => void }).__setTheme;
    if (set == null) {
      throw new Error("the build has no theme test hook: run npm run web:export");
    }
    set(theme);
  }, name);
}

async function expectColor(page: Page, testId: string, hex: string, where: string) {
  await expect
    .poll(
      () =>
        page
          .getByTestId(testId)
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      { message: where },
    )
    .toBe(rgb(hex));
}

async function scan(page: Page, where: string) {
  const result = await new AxeBuilder({ page }).analyze();
  const bad = result.violations.filter(
    (finding) => finding.impact === "serious" || finding.impact === "critical",
  );
  expect(
    bad.map((finding) => ({
      id: finding.id,
      nodes: finding.nodes.map((node) => node.target.join(" ")),
    })),
    where,
  ).toEqual([]);
}

test.describe("runtime theme switch", () => {
  test("repaints Lists without a reload", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await expectColor(page, "lists-screen", THEMES.budget.paper, "before");

    // A reload would clear this marker.
    await page.evaluate(() => {
      (globalThis as { __alive?: string }).__alive = "yes";
    });
    await setTheme(page, "midnight");

    await expectColor(page, "lists-screen", THEMES.midnight.paper, "after");
    expect(
      await page.evaluate(() => (globalThis as { __alive?: string }).__alive),
    ).toBe("yes");
  });

  test("keeps the choice across a restart", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await setTheme(page, "clay");
    await expectColor(page, "lists-screen", THEMES.clay.paper, "before reload");

    await page.reload();
    await expect(row(page, undated.second)).toBeVisible();

    expect(
      await page.evaluate(() => localStorage.getItem("monkey-tasks.theme")),
    ).toBe("clay");
    await expectColor(page, "lists-screen", THEMES.clay.paper, "after reload");
  });

  test("keeps the scroll offset and the open capture sheet", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    await expectColor(page, "planner-screen", THEMES.budget.paper, "planner before");

    const scroller = page.getByTestId("timeline-scroller");
    // The DOM setter reads back at once; scrollTo animates on a frame.
    await scroller.evaluate((element) => {
      element.scrollTop = 140;
    });
    const offset = await scroller.evaluate((element) => element.scrollTop);
    expect(offset, "the timeline scrolls").toBeGreaterThan(0);

    await press(page, page.getByRole("button", { name: "add task" }));
    const dialog = page.getByRole("dialog", { name: "Add a task" });
    await expect(dialog).toBeVisible();
    await page.getByPlaceholder("Add a task").fill("still here");
    await expectColor(page, "planner-screen", THEMES.budget.paper, "sheet open");

    await setTheme(page, "midnight");

    await expect(dialog).toBeVisible();
    await expect(page.getByPlaceholder("Add a task")).toHaveValue("still here");
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(offset);
    await expectColor(page, "planner-screen", THEMES.midnight.paper, "planner after");
    await expect
      .poll(() => dialog.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe(rgb(THEMES.midnight.surface));
  });
});

test.describe("every palette", () => {
  for (const name of names) {
    test(`axe holds on every screen in ${name}`, async ({ page }) => {
      await page.goto("/");
      await setTheme(page, name);
      await expect(row(page, undated.second)).toBeVisible();
      await scan(page, `${name} lists`);

      await page.goto("/planner");
      await expect(page.getByTestId("day-heading")).toBeVisible();
      await scan(page, `${name} planner day`);

      await page.getByRole("tab", { name: "Week", exact: true }).click();
      await expect(
        page.getByRole("button", { name: tomorrow.short }),
      ).toBeVisible();
      await scan(page, `${name} planner week`);

      await page.getByRole("tab", { name: "Month", exact: true }).click();
      await expect(page.getByTestId("month-title")).toBeVisible();
      await scan(page, `${name} planner month`);

      await page.goto("/");
      await expect(row(page, undated.second)).toBeVisible();
      await press(
        page,
        row(page, undated.second).getByRole("button", { name: undated.second }),
      );
      await expect(
        page.getByRole("textbox", { name: "Name", exact: true }),
      ).toBeVisible();
      await scan(page, `${name} editor`);

      await page.goto("/");
      await expect(row(page, undated.second)).toBeVisible();
      await press(page, page.getByRole("button", { name: "add task" }));
      await expect(
        page.getByRole("dialog", { name: "Add a task" }),
      ).toBeVisible();
      await scan(page, `${name} capture sheet`);
    });
  }
});
