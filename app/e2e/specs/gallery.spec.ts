import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect, test } from "../fixtures";
import { press, tabTo } from "../locators";
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

/**
 * The page draws what the palette and the layout fix, not the pixels.
 * The CI runner renders the check glyph in a done row 2 px from where
 * this machine draws it, so a pixel baseline cannot be green on both.
 * The shot below is review evidence; these assertions carry the check
 * (ADR 20261112-component-gallery).
 */
async function checkPaint(
  page: Page,
  palette: ThemeName,
  width: number,
  where: string,
) {
  const p = THEMES[palette];
  const cell = (id: GalleryStateId) => page.getByTestId(stateTestId(id));
  const heading = (id: GalleryStateId) => cell(id).getByRole("heading");

  await expect(page.getByTestId("gallery"), `${where} ground`).toHaveCSS(
    "background-color",
    rgb(p.paper),
  );
  await expect(
    cell("button:primary").getByRole("button"),
    `${where} primary fill`,
  ).toHaveCSS("background-color", rgb(p.accent));
  await expect(
    cell("button:secondary").getByRole("button"),
    `${where} secondary fill`,
  ).toHaveCSS("background-color", rgb(p.accentSoft));
  await expect(
    cell("button:disabled").getByRole("button"),
    `${where} disabled fill`,
  ).toHaveCSS("background-color", rgb(p.pressed));
  await expect(
    cell("segmented-control:selected").getByRole("tab", { name: "Week" }),
    `${where} selected segment`,
  ).toHaveCSS("background-color", rgb(p.accent));
  await expect(heading("section-header:accent"), `${where} accent ink`).toHaveCSS(
    "color",
    rgb(p.accent),
  );
  await expect(heading("section-header:danger"), `${where} danger ink`).toHaveCSS(
    "color",
    rgb(p.danger),
  );
  await expect(heading("section-header:muted"), `${where} muted ink`).toHaveCSS(
    "color",
    rgb(p.inkMuted),
  );
  await expect(
    cell("banner:danger").getByRole("alert"),
    `${where} danger banner`,
  ).toHaveCSS("background-color", rgb(p.dangerSoft));
  await expect(
    cell("banner:info").getByRole("alert"),
    `${where} info banner`,
  ).toHaveCSS("background-color", rgb(p.accentSoft));
  await expect(
    cell("text-field:error").getByRole("textbox"),
    `${where} error edge`,
  ).toHaveCSS("border-top-color", rgb(p.danger));

  const box = await page.getByTestId("gallery-scroll").evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(box.scroll, `${where} no sideways scroll`).toBe(box.client);
  expect(box.client, `${where} the page holds the window width`).toBe(width);

  const layout = await page.getByTestId("gallery").evaluate((root) => {
    const edge = window.innerWidth + 0.5;
    const outside: string[] = [];
    for (const element of root.querySelectorAll('[data-testid^="gallery-state:"]')) {
      const rect = element.getBoundingClientRect();
      if (rect.left < -0.5 || rect.right > edge) {
        outside.push(element.getAttribute("data-testid") ?? "");
      }
    }
    const order = Array.from(
      root.querySelectorAll('[data-testid^="gallery-section:"]'),
    ).map((element) =>
      (element.getAttribute("data-testid") ?? "").replace("gallery-section:", ""),
    );
    return { outside, order };
  });
  expect(layout.outside, `${where} cells inside the page`).toEqual([]);
  expect(layout.order, `${where} section order`).toEqual(
    GALLERY_SECTIONS.map((section) => section.id),
  );
}

/**
 * One shot per palette and width for review. It grows the window to the
 * page's full height and asserts that nothing is clipped, then attaches
 * the file to the report and keeps it under `build/` (gitignored).
 */
async function capture(
  page: Page,
  palette: ThemeName,
  width: number,
  testInfo: TestInfo,
) {
  const scroller = page.getByTestId("gallery-scroll");
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  // The header sits above the scroller, so the window needs its own
  // chrome on top of the content height.
  const height = await scroller.evaluate((element) =>
    Math.ceil(element.scrollHeight + (window.innerHeight - element.clientHeight)),
  );
  expect(height, `${palette} ${width}: the page fits one shot`).toBeLessThan(12000);
  await page.setViewportSize({ width, height });
  expect(
    await scroller.evaluate((element) => element.scrollHeight <= element.clientHeight),
    `${palette} ${width}: nothing is clipped`,
  ).toBe(true);

  const dir = path.join(
    process.cwd(),
    "build",
    "verify",
    "evidence",
    "component-gallery",
  );
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `gallery-${palette}-${width}.png`);
  await page.screenshot({ path: file, animations: "disabled", caret: "hide" });
  await testInfo.attach(`gallery-${palette}-${width}`, {
    path: file,
    contentType: "image/png",
  });

  await page.setViewportSize({ width, height: 915 });
}

/**
 * One shot of a focused control for review. The page shot at rest holds
 * no focus, so this is the image that shows the mark.
 */
async function captureFocus(
  name: string,
  target: Locator,
  testInfo: TestInfo,
) {
  const dir = path.join(
    process.cwd(),
    "build",
    "verify",
    "evidence",
    "component-gallery",
  );
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `focus-${name}.png`);
  await target.screenshot({ path: file, animations: "disabled" });
  await testInfo.attach(`focus-${name}`, {
    path: file,
    contentType: "image/png",
  });
}

/** Lets the browser paint two frames, so an entrance has started. */
async function painted(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
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
  // The menu fades and grows in. A computed opacity can read 1 in the
  // frame before the fade starts, so wait for a paint first, then for
  // the fade to land. The target floor and the axe scan read the menu
  // at rest.
  await painted(page);
  await expect(menu).toHaveCSS("opacity", "1");

  for (const name of ["Open task", "Move to list Pick a list", "Delete task"]) {
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
  const retry = toast.getByRole("button", { name: "Retry" });
  const dismiss = toast.getByRole("button", { name: "Dismiss" });
  await expect(retry, where).toBeVisible();
  await expect(dismiss, where).toBeVisible();

  for (const [name, target] of [
    ["Retry", retry],
    ["Dismiss", dismiss],
  ] as const) {
    const box = await target.boundingBox();
    expect(box?.width ?? 0, `${where} toast ${name} width`).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0, `${where} toast ${name} height`).toBeGreaterThanOrEqual(44);
  }

  // The page's two banners are alerts too, and the open overlay leaves
  // them inert, so axe skips them.
  await scan(page, `${where} toast`, { include: '[role="alert"]' });

  await press(page, toast.getByRole("button", { name: "Dismiss" }));
  await expect(toast, where).toHaveCount(0);
}

test.describe("the gallery", () => {
  // Every state, name, target and axe scan, at two widths. One palette
  // already runs near 25 seconds, so the default 30 second budget left
  // no room for a loaded machine.
  test.describe.configure({ timeout: 90_000 });
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
        await checkPaint(page, palette, width, where);

        if (testInfo.project.name === "motion") {
          await capture(page, palette, width, testInfo);
        }

        await checkMenu(page, where);
        await checkSheet(page, where);
        await checkCommandPane(page, where);
        await checkToast(page, where);
      }
    });
  }

  test("the focus cells follow the keyboard and drop for the pointer", async ({
    page,
  }, testInfo) => {
    await openGallery(page, "budget", 412);

    const press = page.getByTestId("gallery-press-focused");
    await tabTo(page, press);
    await expect(press).toBeFocused();
    await expect(press).toHaveCSS("outline-style", "solid");
    await expect(press).toHaveCSS("outline-width", "2px");
    await expect(press).toHaveCSS("outline-color", rgb(THEMES.budget.focusRing));
    if (testInfo.project.name === "motion") {
      await captureFocus("pressable-budget", press, testInfo);
    }

    const icon = page
      .getByTestId(stateTestId("icon-button:focused"))
      .getByRole("button", { name: "sort tasks, focused" });
    await tabTo(page, icon);
    await expect(icon).toHaveCSS("outline-color", rgb(THEMES.budget.focusRing));
    if (testInfo.project.name === "motion") {
      await captureFocus("icon-button-budget", icon, testInfo);
    }

    // The control keeps focus through the press, so only the pointer's
    // own verdict can drop the mark.
    await icon.hover();
    await page.mouse.down();
    await expect(icon).toHaveCSS("outline-style", "none");
    await page.mouse.up();
    await expect(icon).toBeFocused();
    await expect(icon).toHaveCSS("outline-style", "none");

    const field = page
      .getByTestId(stateTestId("text-field:focused"))
      .getByRole("textbox", { name: "Task name" });
    await tabTo(page, field);
    await expect(field).toBeFocused();
  });

  test("the press paints its ground", async ({ page }) => {
    await openGallery(page, "budget", 412);

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
