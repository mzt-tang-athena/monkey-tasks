import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { press } from "../locators";
import { smallTargets } from "../targets";
import { rgb, setTheme } from "../theme";
import { THEMES, THEME_NAMES, type ThemeName } from "../../src/theme/palettes";
import {
  GALLERY_SECTIONS,
  GALLERY_STATE_IDS,
  stateTestId,
  type GalleryStateId,
} from "../../src/features/gallery/model";

/**
 * Ticket 20261112: the gallery draws every primitive in every state, in
 * every palette, at 360 and 412 wide. This spec walks the same matrix
 * the page renders: presence, names, the 44pt floor, axe, and one
 * screenshot per palette and width.
 */

const palettes = Object.keys(THEMES) as ThemeName[];
const widths = [360, 412];

const labels = new Map<GalleryStateId, string>(
  GALLERY_SECTIONS.flatMap((section) =>
    section.states.map((state) => [state.id, state.label] as const),
  ),
);

/**
 * WCAG exempts disabled text, and the faint step is the receding mark
 * for done work (ADR 20261111-runtime-theme-provider). Both sit below
 * 4.5 to 1 on purpose, so the contrast rule skips those two cells.
 */
const exemptFromContrast = [
  '[data-testid="gallery-state:button:disabled"]',
  '[data-testid="gallery-state:section-header:faint"]',
];

async function scan(
  page: Page,
  where: string,
  options: { include?: string; exclude?: string[] } = {},
) {
  const builder = new AxeBuilder({ page });
  if (options.include != null) {
    builder.include(options.include);
  }
  if (options.exclude != null) {
    builder.exclude(options.exclude);
  }
  const result = await builder.analyze();
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

async function openGallery(page: Page, palette: ThemeName, width: number) {
  await page.setViewportSize({ width, height: 915 });
  await page.goto("/gallery");
  await setTheme(page, palette);
  await expect(page.getByTestId("gallery")).toBeVisible();
  await expect(
    page.getByTestId("gallery-context"),
    `${palette} at ${width}`,
  ).toHaveText(`${THEME_NAMES[palette]} at ${width} wide`);
}

/**
 * The controls the gallery draws, without a name. A press target reads
 * its label; a text input reads its label or its placeholder.
 */
async function unnamedControls(page: Page): Promise<string[]> {
  return page.getByTestId("gallery").evaluate((root) => {
    const roles = [
      "button",
      "tab",
      "checkbox",
      "radio",
      "menuitem",
      "menuitemradio",
      "link",
      "switch",
      "slider",
      "searchbox",
    ];
    const unnamed: string[] = [];
    for (const role of roles) {
      for (const element of root.querySelectorAll(`[role="${role}"]`)) {
        const name = element.getAttribute("aria-label") ?? "";
        const text = (element.textContent ?? "").trim();
        if (name.trim() === "" && text === "") {
          unnamed.push(role);
        }
      }
    }
    for (const input of root.querySelectorAll("input, textarea")) {
      const name =
        input.getAttribute("aria-label") ?? input.getAttribute("placeholder") ?? "";
      if (name.trim() === "") {
        unnamed.push("textbox");
      }
    }
    return unnamed;
  });
}

/** One screenshot holds the whole page: grow the window, then prove it fits. */
async function shoot(page: Page, palette: ThemeName, width: number) {
  const scroller = page.getByTestId("gallery-scroll");
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  // The header sits above the scroller, so the window needs its own
  // chrome on top of the content height.
  const height = await scroller.evaluate((element) =>
    Math.ceil(element.scrollHeight + (window.innerHeight - element.clientHeight)),
  );
  expect(height, `${palette} ${width}: the page fits one screenshot`).toBeLessThan(
    12000,
  );
  await page.setViewportSize({ width, height });
  expect(
    await scroller.evaluate((element) => element.scrollHeight <= element.clientHeight),
    `${palette} ${width}: nothing is clipped`,
  ).toBe(true);
  await expect(page).toHaveScreenshot(`gallery-${palette}-${width}.png`, {
    animations: "disabled",
    caret: "hide",
  });
}

async function checkMenu(page: Page, where: string) {
  await press(
    page,
    page
      .getByTestId(stateTestId("menu:open"))
      .getByRole("button", { name: "Open menu" }),
  );
  const menu = page.getByRole("menu", { name: "Row actions" });
  await expect(menu, where).toBeVisible();
  await expect(menu).toHaveCSS("opacity", "1");

  for (const name of ["Open task", "Move to list", "Delete task"]) {
    await expect(menu.getByRole("menuitem", { name }), where).toBeVisible();
  }
  await expect(
    menu.getByRole("menuitemradio", { name: "Mark done" }),
    where,
  ).toHaveAttribute("aria-checked", "true");

  expect(await smallTargets(page, '[role="menu"]'), `${where} targets`).toEqual([]);
  await scan(page, `${where} menu`, { include: '[role="menu"]' });

  await page.keyboard.press("Escape");
  await expect(menu, where).toHaveCount(0);
}

async function checkSheet(page: Page, where: string) {
  await press(
    page,
    page
      .getByTestId(stateTestId("sheet:open"))
      .getByRole("button", { name: "Open sheet" }),
  );
  const sheet = page.getByRole("dialog", { name: "Add a task" });
  await expect(sheet, where).toBeVisible();
  await expect(sheet).toHaveCSS("opacity", "1");
  await expect(sheet.getByRole("textbox", { name: "Name" }), where).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Save" }), where).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Cancel" }), where).toBeVisible();

  expect(
    await smallTargets(page, '[role="dialog"]'),
    `${where} targets`,
  ).toEqual([]);
  await scan(page, `${where} sheet`, { include: '[role="dialog"]' });

  await page.keyboard.press("Escape");
  await expect(sheet, where).toHaveCount(0);
}

async function checkCommandPane(page: Page, where: string) {
  await press(
    page,
    page
      .getByTestId(stateTestId("command-pane:open"))
      .getByRole("button", { name: "Open command pane" }),
  );
  const pane = page.getByRole("dialog", { name: "Commands" });
  await expect(pane, where).toBeVisible();
  await expect(pane).toHaveCSS("opacity", "1");
  await expect(
    pane.getByRole("searchbox", { name: "Search commands" }),
    where,
  ).toBeVisible();
  for (const name of ["Settings App", "Open planner Week", "Open lists Main"]) {
    await expect(pane.getByRole("button", { name }), where).toBeVisible();
  }

  expect(
    await smallTargets(page, '[role="dialog"]'),
    `${where} targets`,
  ).toEqual([]);
  await scan(page, `${where} command pane`, { include: '[role="dialog"]' });

  await page.keyboard.press("Escape");
  await expect(pane, where).toHaveCount(0);
}

async function checkToast(page: Page, where: string) {
  await press(
    page,
    page
      .getByTestId(stateTestId("toast:open"))
      .getByRole("button", { name: "Show toast" }),
  );
  const toast = page
    .locator('[role="alert"]')
    .filter({ hasText: "Could not save the task" });
  await expect(toast, where).toBeVisible();
  await expect(toast.getByRole("button", { name: "Retry" }), where).toBeVisible();
  await expect(
    toast.getByRole("button", { name: "Dismiss" }),
    where,
  ).toBeVisible();

  const box = await toast.boundingBox();
  expect(box?.height ?? 0, `${where} toast target`).toBeGreaterThanOrEqual(44);

  // The page's two banners are alerts too, and the open overlay leaves
  // them inert, so axe skips them.
  await scan(page, `${where} toast`, { include: '[role="alert"]' });

  await press(page, toast.getByRole("button", { name: "Dismiss" }));
  await expect(toast, where).toHaveCount(0);
}

test.describe("the gallery", () => {
  test("opens from Diagnostics and from nowhere else", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("bottom-bar")).toBeVisible();
    await expect(page.getByText(/gallery/i)).toHaveCount(0);

    await page.goto("/dev");
    const open = page.getByRole("button", { name: "Open gallery" });
    await expect(open).toBeVisible();
    await press(page, open);

    await expect(page).toHaveURL("/gallery");
    await expect(page.getByTestId("gallery")).toBeVisible();
    await expect(page.getByTestId("bottom-bar")).toHaveCount(0);
  });

  for (const palette of palettes) {
    test(`${palette}: every state, name, target and axe, at 360 and 412`, async ({
      page,
    }, testInfo) => {
      for (const width of widths) {
        const where = `${palette} ${width}`;
        await openGallery(page, palette, width);

        for (const state of GALLERY_STATE_IDS) {
          const cell = page.getByTestId(stateTestId(state));
          await expect(cell, `${where} ${state}`).toBeVisible();
          await expect(
            cell.getByTestId("gallery-state-label"),
            `${where} ${state} label`,
          ).toHaveText(labels.get(state) ?? "");
        }

        expect(await unnamedControls(page), `${where} unnamed controls`).toEqual(
          [],
        );
        expect(await smallTargets(page, '[data-testid="gallery"]'), where).toEqual(
          [],
        );

        await scan(page, `${where} gallery`, { exclude: exemptFromContrast });

        await checkMenu(page, where);
        await checkSheet(page, where);
        await checkCommandPane(page, where);
        await checkToast(page, where);

        if (testInfo.project.name === "motion") {
          await shoot(page, palette, width);
        }
      }
    });
  }

  test("the focused state holds focus and the press paints its ground", async ({
    page,
  }) => {
    await openGallery(page, "budget", 412);

    await expect(
      page
        .getByTestId(stateTestId("text-field:focused"))
        .getByRole("textbox", { name: "Task name" }),
    ).toBeFocused();

    const target = page.getByTestId("gallery-press-rest");
    await expect(target).toHaveCSS(
      "background-color",
      rgb(THEMES.budget.accentSoft),
    );
    await expect(page.getByTestId("gallery-press-pressed")).toHaveCSS(
      "background-color",
      rgb(THEMES.budget.pressed),
    );

    await target.hover();
    await page.mouse.down();
    await expect(target).toHaveCSS(
      "background-color",
      rgb(THEMES.budget.pressed),
    );
    await page.mouse.up();
    await expect(target).toHaveCSS(
      "background-color",
      rgb(THEMES.budget.accentSoft),
    );
  });
});
