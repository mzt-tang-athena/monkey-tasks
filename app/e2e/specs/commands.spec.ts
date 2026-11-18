import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { tabs, undated } from "../data";
import { holdDrag, scrollTopOf, swipe, touchFlick } from "../gestures";
import { expectBefore, expectAbove, listTab, row } from "../locators";

/**
 * Ticket 0085 and its 2026-11-18 amendment: the command pane slides
 * down over the current screen. A downward pull at the top of a page,
 * a pull on a header band, the bar's Command half, or the pane's own
 * button opens it. The search takes focus, a command runs and closes
 * the pane, and a pull on a page scrolled away from its top only
 * scrolls. A pager swipe, a row drag, the day split and a sheet leave
 * it shut.
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

/** A two-finger touch drag down over `from`, through CDP. */
async function twoFingerPull(page: Page, from: Locator, dy: number): Promise<void> {
  const box = await from.boundingBox();
  if (box == null) {
    throw new Error("the pull source has no box");
  }
  const cdp = await page.context().newCDPSession(page);
  const at = [0.4, 0.6].map((share) => ({
    x: box.x + box.width * share,
    y: box.y + box.height / 2,
  }));
  const send = (type: "touchStart" | "touchMove" | "touchEnd", points = at) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  await send("touchStart");
  for (let step = 1; step <= 14; step += 1) {
    await send(
      "touchMove",
      at.map((point) => ({ x: point.x, y: point.y + (dy * step) / 14 })),
    );
    await page.waitForTimeout(16);
  }
  await send("touchEnd", []);
  await cdp.detach();
}

test.describe("opening", () => {
  test("a pull at the top of the Lists page opens it with the search focused", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await touchFlick(page, page.getByTestId("lists-screen"), 140);

    await expect(pane(page)).toBeVisible();
    await expect(search(page)).toBeFocused();
    // The row under the pull never opened its editor.
    await expect(page.getByRole("dialog", { name: "Task" })).toHaveCount(0);
  });

  test("a pull at the top of Planner, Journal and Inbox Notes opens it", async ({
    page,
  }) => {
    const pages = [
      { path: "/planner", screen: "planner-screen", from: "timeline-scroller" },
      { path: "/journal", screen: "journal-screen", from: "journal-screen" },
      { path: "/inbox", screen: "inbox-notes-screen", from: "inbox-notes-screen" },
    ];
    for (const each of pages) {
      await page.goto(each.path);
      await expect(page.getByTestId(each.screen)).toBeVisible();

      await touchFlick(page, page.getByTestId(each.from), 140);

      await expect(pane(page), each.path).toBeVisible();
      await page.keyboard.press("Escape");
      await expectShut(page);
    }
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

  test("a downward pull on the Lists header band opens it", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await pull(page, page.getByTestId("header-band-lists").filter({ visible: true }), 140);

    await expect(pane(page)).toBeVisible();
  });

  test("a downward pull on the Planner header band opens it too", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();

    await pull(
      page,
      page.getByTestId("header-band-planner").filter({ visible: true }),
      140,
    );

    await expect(pane(page)).toBeVisible();
  });

  test("a two-finger swipe down on the header band opens it", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await twoFingerPull(
      page,
      page.getByTestId("header-band-lists").filter({ visible: true }),
      140,
    );

    await expect(pane(page)).toBeVisible();
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

test.describe("the headers", () => {
  test("the Planner header drops its chevron and its gear", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    const band = page.getByTestId("header-band-planner").filter({ visible: true });

    await expect(band.getByRole("button", { name: "open commands" })).toHaveCount(0);
    await expect(band.getByRole("button", { name: "open settings" })).toHaveCount(0);

    // The mode switch takes the row.
    const mode = band.getByRole("tab", { name: "Month" });
    const width = page.viewportSize()?.width ?? 412;
    const box = await mode.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan(width - 48);
  });

  test("the Lists toolbar drops its chevron and keeps the three-dot menu", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    const band = page.getByTestId("header-band-lists").filter({ visible: true });

    await expect(band.getByRole("button", { name: "open commands" })).toHaveCount(0);
    await expect(band.getByRole("button", { name: "list menu" })).toBeVisible();
    await expect(band.getByRole("button", { name: "sort list" })).toBeVisible();
  });
});

test.describe("the page pull", () => {
  test("a pull scrolled away from the top only scrolls", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    const marker = row(page, undated.second);
    const box = await page.getByTestId("lists-screen").boundingBox();
    if (box == null) {
      throw new Error("the list has no box");
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 150);
    await expect.poll(() => scrollTopOf(marker)).toBeGreaterThan(0);
    const before = await scrollTopOf(marker);

    // The pull reaches the top partway through and keeps going.
    await touchFlick(page, page.getByTestId("lists-screen"), 300);

    await expectShut(page);
    await expect.poll(() => scrollTopOf(marker)).toBeLessThan(before);
  });

  test("the pager's sideways swipe leaves it shut", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();

    await swipe(page, page.getByTestId("day-pager"), "left");

    await expectShut(page);
  });

  test("a row drag leaves it shut", async ({ page }) => {
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

    // The drag happened: the second row took first place.
    await expectAbove(row(page, undated.second), row(page, undated.first));
    await expectShut(page);
  });

  test("a day-split drag leaves it shut", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    const grip = page.getByTestId("day-split:grip");
    const before = Number(await grip.getAttribute("aria-valuenow"));

    await holdDrag(page, grip, page.getByTestId("day-split:bottom"), {
      holdMs: 0,
    });

    // The drag moved the split, and the pane stayed shut.
    await expect
      .poll(async () => Number(await grip.getAttribute("aria-valuenow")))
      .not.toBe(before);
    await expectShut(page);
  });

  test("a pull inside a sheet leaves the page shut", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await page.getByRole("button", { name: "add task" }).click();
    const sheet = page.getByRole("dialog", { name: "Add a task" });
    await expect(sheet).toBeVisible();

    await touchFlick(page, sheet, 200);

    await expectShut(page);
    await expect(sheet).toBeVisible();
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
