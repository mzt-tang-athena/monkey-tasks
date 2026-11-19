import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { tabs, undated } from "../data";
import { holdDrag, swipe, touchFlick } from "../gestures";
import { expectBefore, listTab, row } from "../locators";
import { putNote } from "../vault";

/**
 * Ticket 0085 and its 2026-11-18 amendment: the command pane slides
 * down over the current screen. A downward swipe on the bottom bar's
 * gap opens it, and so does the bar's Command half. The search takes
 * focus, a command runs and closes the pane, and no tab, pill, list
 * body or header band starts the gesture. The bar's split Add pill
 * opens the tab's own sheet from its plus half.
 */

function pane(page: Page): Locator {
  return page.getByRole("dialog", { name: "Commands" });
}

function search(page: Page): Locator {
  return page.getByPlaceholder("Search commands");
}

function openButton(page: Page): Locator {
  return page
    .getByRole("button", { name: "open commands" })
    .filter({ visible: true });
}

function command(page: Page, id: string): Locator {
  return page.getByTestId(`command:${id}`);
}

async function openPane(page: Page): Promise<void> {
  await openButton(page).click();
  await expect(pane(page)).toBeVisible();
}

/** A mouse drag in a straight line from `from` by `dy`. */
async function pull(page: Page, from: Locator, dy: number): Promise<void> {
  const box = await from.boundingBox();
  if (box == null) {
    throw new Error("the pull source has no box");
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 14 });
  await page.mouse.up();
}

async function expectShut(page: Page): Promise<void> {
  await expect(pane(page)).toHaveCount(0);
}

test.describe("opening", () => {
  test("a downward swipe on the bar's gap opens it with the search focused", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await touchFlick(page, page.getByTestId("bar-gap"), 120);

    await expect(pane(page)).toBeVisible();
    await expect(search(page)).toBeFocused();
  });

  test("a mouse pull on the bar's gap opens it too", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await pull(page, page.getByTestId("bar-gap"), 140);

    await expect(pane(page)).toBeVisible();
  });

  test("the bar's Command half opens it, and Escape puts focus back", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    const opener = openButton(page);
    await opener.focus();
    await opener.click();
    await expect(pane(page)).toBeVisible();
    await expect(search(page)).toBeFocused();

    await page.keyboard.press("Escape");
    await expectShut(page);
    await expect(opener).toBeFocused();
  });

  test("a pull up on the pane's top edge closes it", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    // The spring must land before the grab area is on screen.
    await expect
      .poll(async () => (await page.getByTestId("command-pull").boundingBox())?.y ?? -1)
      .toBeGreaterThanOrEqual(0);
    await pull(page, page.getByTestId("command-search"), -70);

    await expectShut(page);
  });
});

test.describe("the bar's own controls keep their gestures", () => {
  test("a swipe down on a tab opens nothing and keeps its tab", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await touchFlick(page, listTab(page, tabs.main), 120);

    await expectShut(page);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
  });

  test("a swipe down on the Add half opens nothing and no sheet", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await touchFlick(
      page,
      page.getByRole("button", { name: "add task" }).filter({ visible: true }),
      120,
    );

    await expectShut(page);
    await expect(page.getByRole("dialog", { name: "Add a task" })).toHaveCount(0);
  });
});

test.describe("no page starts the pane", () => {
  test("a pull on a list body opens no pane and keeps the row", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await touchFlick(page, page.getByTestId("lists-screen"), 160);

    await expectShut(page);
    await expect(row(page, undated.second)).toBeVisible();
  });

  test("a pull on the Planner body opens no pane", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();

    await touchFlick(page, page.getByTestId("timeline-scroller"), 160);

    await expectShut(page);
  });

  test("a pager swipe and a row drag leave it shut", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    await swipe(page, page.getByTestId("day-pager"), "left");
    await expectShut(page);

    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await page.getByRole("button", { name: "sort list" }).click();
    await page.getByRole("radio", { name: "My order Drag rows to sort" }).click();
    await holdDrag(
      page,
      page.getByTestId(`reorder-grip:${undated.second}`),
      row(page, undated.first),
      { at: "upper", holdMs: 0 },
    );
    await expectShut(page);
  });
});

test.describe("the headers", () => {
  test("the Planner header drops its chevron and its gear", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    const header = page.getByTestId("planner-header");

    await expect(header.getByRole("button", { name: "open commands" })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "open settings" })).toHaveCount(0);

    // The mode switch takes the row.
    const mode = header.getByRole("tab", { name: "Month" });
    const width = page.viewportSize()?.width ?? 412;
    const box = await mode.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan(width - 48);
  });

  test("the Lists toolbar drops its chevron and keeps the three-dot menu", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    const band = page.getByTestId("lists-toolbar");

    await expect(band.getByRole("button", { name: "open commands" })).toHaveCount(0);
    await expect(band.getByRole("button", { name: "list menu" })).toBeVisible();
    await expect(band.getByRole("button", { name: "sort list" })).toBeVisible();
  });
});

test.describe("searching and choosing", () => {
  test("filters the rows and runs the chosen command", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    await search(page).fill("plan");
    await expect(command(page, "planner")).toBeVisible();
    await expect(command(page, "capture")).toHaveCount(0);

    await command(page, "planner").click();
    await expect(page).toHaveURL("/planner");
    await expectShut(page);
  });

  test("the recent command moves to the front", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);
    await command(page, "planner").click();
    await expect(page).toHaveURL("/planner");
    await expectShut(page);

    await page.goBack();
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    await expectBefore(command(page, "planner"), command(page, "capture"));
  });
});

test.describe("every command", () => {
  test("Add task opens the capture sheet", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    await command(page, "capture").click();
    await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
    await expectShut(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Add a task" })).toHaveCount(0);

    // The Planner's dock answers too: the command reaches the focused
    // tab, not only Lists.
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    await openPane(page);
    await command(page, "capture").click();
    await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
  });

  test("Reload vault rereads the folder", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    // Another app writes a note while the screen holds its read.
    await putNote(
      page,
      "Tasks/Written elsewhere.md",
      "---\nkind: \"[[tasks]]\"\ncreated: 2026-10-26T09:00\n---\n\nA note from another app.\n",
    );
    await expect(row(page, "Written elsewhere")).toHaveCount(0);

    await openPane(page);
    await command(page, "reload").click();

    await expect(page).toHaveURL("/");
    await expect(row(page, "Written elsewhere")).toBeVisible();
  });

  test("Go to Lists and Go to Planner change the screen", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    await openPane(page);
    await command(page, "lists").click();
    await expect(page).toHaveURL("/");
    await expectShut(page);

    await openPane(page);
    await command(page, "planner").click();
    await expect(page).toHaveURL("/planner");
    await expectShut(page);
  });

  test("Switch list goes to Lists on the next list", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    await expect(command(page, "switch")).toHaveAttribute(
      "aria-label",
      `Switch list To ${tabs.next}`,
    );
    await command(page, "switch").click();
    await expect(page).toHaveURL("/");
    await expectShut(page);
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
  });

  test("Sort mode, Theme and Settings open the Settings screen", async ({ page }) => {
    for (const id of ["sort", "theme", "settings"]) {
      await page.goto("/");
      await expect(row(page, undated.second)).toBeVisible();
      await openPane(page);
      await command(page, id).click();
      await expect(page).toHaveURL("/settings");
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
      await expectShut(page);
    }
  });

  test("Diagnostics opens the dev screen", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);
    await command(page, "diagnostics").click();
    await expect(page).toHaveURL("/dev");
    await expectShut(page);
  });
});

test.describe("the bar's split Add pill", () => {
  test("the Add half opens the tab's sheet and the Command half opens the pane", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await page.getByRole("button", { name: "add task" }).click();
    await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
    await page.keyboard.press("Escape");

    await openButton(page).click();
    await expect(pane(page)).toBeVisible();
  });

  test("both halves are 44pt, and four tabs and the pill fit 360 wide", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    const targets = ["Lists", "Planner", "Journal", "Inbox Notes", "add task", "open commands"];
    for (const name of targets) {
      const box = await page
        .getByRole(name === "add task" || name === "open commands" ? "button" : "tab", {
          name,
        })
        .filter({ visible: true })
        .boundingBox();
      expect(box, name).not.toBeNull();
      // Every target is 44pt and sits inside the 360pt bar.
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360.5);
    }

    // The gap is the swipe target, so it keeps a real box too.
    const gap = await page.getByTestId("bar-gap").boundingBox();
    expect(gap?.width ?? 0).toBeGreaterThanOrEqual(23.5);
    expect(gap?.height ?? 0).toBeGreaterThanOrEqual(43.5);

    // Nothing spills sideways: the bar fits the phone.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("access", () => {
  test("every row is a 44pt target the keyboard reaches", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    const rows = page.getByTestId(/^command:/);
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let at = 0; at < count; at += 1) {
      const item = rows.nth(at);
      const box = await item.boundingBox();
      // The browser rounds a 44pt layout to a fraction under it.
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      await item.focus();
      await expect(item).toBeFocused();
    }

    const result = await new AxeBuilder({ page }).analyze();
    const bad = result.violations.filter(
      (finding) => finding.impact === "serious" || finding.impact === "critical",
    );
    expect(
      bad.map((finding) => ({
        id: finding.id,
        nodes: finding.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
});
