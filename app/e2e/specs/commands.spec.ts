import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, pauseClock, test } from "../fixtures";
import { tabs, undated } from "../data";
import { command, pane, search, swipeOpen } from "../commands";
import { holdDrag, swipe, touchFlick } from "../gestures";
import { addButton, expectAbove, listTab, row, openMain } from "../locators";
import { putNote } from "../vault";

/**
 * Ticket 0085 and its 2026-11-20 amendment: the command pane rises
 * from the bottom edge, as the thumb and the bar's opener are there.
 * The search sits at the bottom of the panel, the rows read up from it,
 * and a drag down puts it back. A swipe down on the bar's Add button
 * opens it, or the button's own "Open commands" action from TalkBack and
 * the keyboard. The search takes focus, a command runs and closes the
 * pane, and no tab, the button's own tap, a list body or a header band
 * starts the gesture.
 */

async function openPane(page: Page): Promise<void> {
  await swipeOpen(page);
  await expect(pane(page)).toBeVisible();
  await settled(page);
}

/** The travel the rise still has to make, in px, from its transform. */
async function riseTravel(page: Page): Promise<number> {
  const transform = await page
    .getByTestId("command-rise")
    .evaluate((element) => getComputedStyle(element).transform);
  const matrix = /matrix\(([^)]*)\)/.exec(transform);
  if (matrix == null) {
    return 0;
  }
  return Number(matrix[1].split(",")[5]);
}

/** Waits for the pane's spring to land, so a raw mouse drag starts on
    the grab area rather than on a panel still climbing past it. */
async function settled(page: Page): Promise<void> {
  await expect.poll(() => riseTravel(page)).toBeLessThanOrEqual(0.5);
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
  test("it rises from the bottom edge: it starts under the screen", async ({
    page,
    reducedMotion,
  }) => {
    test.skip(reducedMotion === "reduce", "the reduced project has no rise to catch");
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();
    const height = page.viewportSize()?.height ?? 915;

    // The button's own "Open commands" key, so the search no longer
    // waits on a press to open the pane.
    await addButton(page).focus();
    await pauseClock(page);
    await page.keyboard.press("ArrowDown");
    // One frame in, the panel still climbs from under the edge.
    await page.clock.runFor(16);
    const climbing = await search(page).boundingBox();
    expect(climbing?.y ?? 0).toBeGreaterThan(height);

    await page.clock.runFor(1000);
    await page.clock.resume();
    await expect(pane(page)).toBeVisible();
    await expect(search(page)).toBeFocused();
    // The panel's bottom edge stands 8pt above the window's own, and
    // the search is its lowest block, one padding above that.
    const panel = await pane(page).boundingBox();
    expect(
      Math.abs((panel?.y ?? 0) + (panel?.height ?? 0) - (height - 8)),
    ).toBeLessThanOrEqual(2);
    const landed = await search(page).boundingBox();
    expect(
      Math.abs((landed?.y ?? 0) + (landed?.height ?? 0) - (height - 16)),
    ).toBeLessThanOrEqual(2);
  });

  test("the search sits at the panel's bottom and the rows read up from it", async ({
    page,
  }) => {
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    // The first row is the one nearest the search, so the ones after it
    // sit above it.
    await expectAbove(command(page, "planner"), command(page, "capture"));
    await expectAbove(command(page, "capture"), search(page));
  });

  test("the Add button opens it from the keyboard, and Escape puts focus back", async ({
    page,
  }) => {
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();

    const opener = addButton(page);
    await opener.focus();
    await page.keyboard.press("ArrowDown");
    await expect(pane(page)).toBeVisible();
    await expect(search(page)).toBeFocused();

    await page.keyboard.press("Escape");
    await expectShut(page);
    await expect(opener).toBeFocused();
  });

  test("a drag down on the title row closes it", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    await pull(page, page.getByTestId("command-grab"), 140);

    await expectShut(page);
  });

  test("a short drag down springs back", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    await pull(page, page.getByTestId("command-grab"), 30);

    await expect(pane(page)).toBeVisible();
    await expect(search(page)).toBeVisible();
  });

  test("with reduced motion it shows with no slide", async ({
    page,
    reducedMotion,
  }) => {
    test.skip(reducedMotion !== "reduce", "the motion project plays the rise");
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();

    await swipeOpen(page);
    const panel = pane(page);
    await expect(panel).toBeVisible();
    const look = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      return { opacity: style.opacity, transform: style.transform };
    });
    expect(look).toEqual({ opacity: "1", transform: "none" });
  });
});

test.describe("the bar's own controls keep their gestures", () => {
  test("a swipe up on a tab opens nothing and keeps its tab", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();

    await touchFlick(page, listTab(page, tabs.main), -120);

    await expectShut(page);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
  });

  test("a tap on the Add button opens the sheet, not the pane", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();

    await addButton(page).click();

    await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
    await expectShut(page);
  });
});

test.describe("no page starts the pane", () => {
  test("a pull on a list body opens no pane and keeps the row", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();

    await touchFlick(page, page.getByTestId("lists-screen"), 160);
    await touchFlick(page, page.getByTestId("lists-screen"), -160);

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
    await openMain(page);
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
    await openMain(page);
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
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    await search(page).fill("plan");
    await expect(command(page, "planner")).toBeVisible();
    await expect(command(page, "capture")).toHaveCount(0);

    await command(page, "planner").click();
    await expect(page).toHaveURL("/planner");
    await expectShut(page);
  });

  test("the recent command moves to the front, nearest the search", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);
    await command(page, "planner").click();
    await expect(page).toHaveURL("/planner");
    await expectShut(page);

    await page.goBack();
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);

    // The rows read up from the search, so the front of the list is its
    // lowest row.
    await expectAbove(command(page, "capture"), command(page, "planner"));
  });
});

test.describe("every command", () => {
  test("Add task opens the capture sheet", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
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
    await openMain(page);
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

  test("the four Go to commands change the screen", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();

    const stops = [
      { id: "journal", url: "/journal", testId: "journal-screen" },
      { id: "inbox", url: "/inbox", testId: "inbox-notes-screen" },
      { id: "lists", url: "/", testId: "lists-screen" },
      { id: "planner", url: "/planner", testId: "day-heading" },
    ] as const;

    for (const stop of stops) {
      await openPane(page);
      await command(page, stop.id).click();
      await expect(page).toHaveURL(stop.url);
      await expect(page.getByTestId(stop.testId).first()).toBeVisible();
      await expectShut(page);
    }
  });

  test("Switch list goes to Lists on the next list", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
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
      await openMain(page);
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
    await openMain(page);
    await expect(row(page, undated.second)).toBeVisible();
    await openPane(page);
    await command(page, "diagnostics").click();
    await expect(page).toHaveURL("/dev");
    await expectShut(page);
  });
});

test.describe("access", () => {
  test("every row is a 44pt target the keyboard reaches", async ({ page }) => {
    await page.goto("/");
    await openMain(page);
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
