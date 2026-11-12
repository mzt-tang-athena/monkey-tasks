import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { supplements, tabs, tomorrow, undated } from "../data";
import { listTab, press, row } from "../locators";
import { rgb } from "../theme";
import { THEMES, type ThemeName } from "../../src/theme/palettes";

/**
 * Ticket 0084: the settings screen owns the theme picker and the two
 * settings the Lists and Planner screens already store. It opens from
 * both tabs, returns to the same tab, and touches no vault note.
 */

const palettes = Object.keys(THEMES) as ThemeName[];

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

async function openFromLists(page: Page) {
  await press(page, page.getByRole("button", { name: "list menu" }));
  await press(page, page.getByRole("menuitem", { name: "Settings" }));
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

async function openFromPlanner(page: Page) {
  await press(page, page.getByRole("button", { name: "open settings" }));
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

async function scan(page: Page, where: string) {
  const result = await new AxeBuilder({ page }).analyze();
  const bad = result.violations.filter(
    (finding) => finding.impact === "serious" || finding.impact === "critical",
  );
  expect(
    bad.map((finding) => ({
      id: finding.id,
      nodes: finding.nodes.map((node) => ({
        target: node.target.join(" "),
        html: node.html,
        why: node.any.map((check) => check.message),
      })),
    })),
    where,
  ).toEqual([]);
}

test.describe("entry points", () => {
  test("opens from Lists in one tap and names every palette", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await openFromLists(page);

    await expect(page).toHaveURL("/settings");
    await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
    expect(
      await page
        .getByRole("radio")
        .evaluateAll((radios) => radios.map((radio) => radio.getAttribute("aria-label"))),
    ).toEqual(["Budget", "Todoist", "Clay", "Midnight"]);
    await expect(page.getByRole("radio", { name: "Budget" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("opens from Planner in one tap", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();

    await openFromPlanner(page);

    await expect(page).toHaveURL("/settings");
  });
});

test.describe("the settings persist", () => {
  test("a theme pick repaints in place and survives a reload", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await expectColor(page, "lists-screen", THEMES.budget.paper, "before");

    await openFromLists(page);
    // A reload would clear this marker.
    await page.evaluate(() => {
      (globalThis as { __alive?: string }).__alive = "yes";
    });

    await press(page, page.getByRole("radio", { name: "Midnight" }));

    await expect(page.getByRole("radio", { name: "Midnight" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expectColor(page, "settings-screen", THEMES.midnight.paper, "settings");
    expect(
      await page.evaluate(() => (globalThis as { __alive?: string }).__alive),
    ).toBe("yes");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Midnight" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expectColor(page, "settings-screen", THEMES.midnight.paper, "after reload");
  });

  test("the two screen settings reach the mounted screens and survive a reload", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    const before = await page.evaluate(() => globalThis.__vault?.files() ?? {});

    await openFromLists(page);
    await press(page, page.getByRole("tab", { name: "My order" }));
    await press(page, page.getByRole("tab", { name: "Chips" }));

    await page.goBack();
    await expect(page).toHaveURL("/");
    // The Lists screen was mounted the whole time: its own sort menu
    // already reads the new order.
    await press(page, page.getByRole("button", { name: "sort list" }));
    await expect(page.getByRole("radio", { name: "My order" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.keyboard.press("Escape");

    // The Planner was mounted too, and its day view now draws chips.
    await press(page, page.getByRole("tab", { name: "Planner", exact: true }));
    await expect(page.getByTestId("day-heading")).toBeVisible();
    await expect(page.getByTestId(`pill:${supplements}`)).toBeVisible();
    await expect(
      page.getByTestId("planner-screen").getByTestId(`task-row:${supplements}`),
    ).toHaveCount(0);

    expect(await page.evaluate(() => globalThis.__vault?.files() ?? {})).toEqual(
      before,
    );

    await page.reload();
    await expect(page.getByTestId("day-heading")).toBeVisible();
    await expect(page.getByTestId(`pill:${supplements}`)).toBeVisible();
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await press(page, page.getByRole("button", { name: "sort list" }));
    await expect(page.getByRole("radio", { name: "My order" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test.describe("back", () => {
  test("returns to the same Lists tab and screen", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await press(page, listTab(page, tabs.next));
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");

    await openFromLists(page);
    await page.goBack();

    await expect(page).toHaveURL("/");
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
  });

  test("returns to the same Planner mode and day", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    await press(page, page.getByRole("tab", { name: "Week", exact: true }));
    await expect(page.getByRole("button", { name: tomorrow.short })).toBeVisible();

    await openFromPlanner(page);
    await page.goBack();

    await expect(page).toHaveURL(/mode=week/);
    await expect(page.getByRole("tab", { name: "Week", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("button", { name: tomorrow.short })).toBeVisible();
  });
});

test.describe("accessibility", () => {
  test("the theme picker reads as a radio group in every palette", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await openFromLists(page);
    await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeVisible();

    for (const name of palettes) {
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      await press(page, page.getByRole("radio", { name: label }));
      await expect(page.getByRole("radio", { name: label })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await scan(page, `settings in ${name}`);
    }
  });
});
