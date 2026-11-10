import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { months, overdue, supplements, tomorrow, undated } from "../data";
import { holdDrag, holdDragTo } from "../gestures";
import { expectAbove, press, row, sectionHeader } from "../locators";
import { putNote, returnToTab } from "../vault";

/**
 * Ticket 0056: the planner split and its bug fixes. Each test here
 * failed on the code before the split.
 */

const groceries = "Groceries: milk, eggs, oats";

/** A task for tomorrow at 8:00 AM. Its name sorts after the others, so
    only the time of day puts it first. */
const early = {
  name: "Zebra walk",
  path: "Tasks/Zebra walk.md",
  text: '---\nkind: "[[tasks]]"\ncreated: 2026-10-26T09:00\ndue: 2026-10-27T08:00\n---\n',
} as const;

/** Add the early task, as another app would. */
async function addEarlyTask(page: Page) {
  await putNote(page, early.path, early.text);
  await returnToTab(page);
}

/**
 * Press a month cell until the pane lists that day. A press can land
 * before the cell's own layout reaches the press handler, and then the
 * handler ignores it; a retry is what a person does too.
 */
async function pickDay(page: Page, name: string) {
  const cell = page.getByRole("gridcell", { name });
  await expect
    .poll(async () => {
      await cell.click();
      return page.getByRole("button", { name: "open this day" }).count();
    })
    .toBeGreaterThan(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/planner");
  await expect(page.getByTestId("day-heading")).toBeVisible();
});

/** The live source toggle, whatever it reads. While a page slides,
    the pager also renders the still preview's toggle; the live one is
    the last in the pager. */
function sourceToggle(page: Page) {
  return page.getByRole("button", { name: /^task source:/ }).last();
}

/** Wait until the source toggle sits above the bottom bar. On a small
    phone the day split paints the timeline at its usual height until
    the layout reports, and the toggle sits over the bar until then.
    Ticket 0061 owns that jump. A busy page can take a second to report,
    so a press must wait for the settled layout, as a user does. */
async function expectToggleAboveBar(page: Page) {
  await expect
    .poll(async () => {
      const toggle = await sourceToggle(page).boundingBox();
      const bar = await page.getByRole("tab", { name: "Planner" }).boundingBox();
      if (toggle == null || bar == null) return Number.POSITIVE_INFINITY;
      return toggle.y + toggle.height - bar.y;
    })
    .toBeLessThanOrEqual(0);
}

/** Hold the source toggle until the chooser opens. */
async function openSourceMenu(page: Page) {
  // `hover` waits for the toggle to stop moving, then points at it.
  await sourceToggle(page).hover();
  await page.mouse.down();
  // A user holds until the chooser shows. A fixed hold can end first
  // on a busy page, and the press then cycles the source.
  await expect(page.getByRole("menu", { name: "task source" })).toBeVisible();
  await page.mouse.up();
}

test("the date strip keeps clear of the top edge", async ({ page }) => {
  const box = await page.getByRole("tab", { name: "Mon 26" }).boundingBox();
  expect(box?.y ?? 0).toBeGreaterThanOrEqual(8);
});

test.describe("on a small phone", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("the day list keeps its source toggle above the bottom bar", async ({ page }) => {
    await expectToggleAboveBar(page);
  });
});

test.describe("the drag ghost", () => {
  /** True when the ghost, not the bottom bar, is the top layer at the
      ghost's centre. The ghost lets touches through, so the test turns
      that off for the check. */
  async function ghostIsOnTop(page: Page) {
    const ghost = page.getByTestId("drag-ghost");
    await expect(ghost).toBeVisible();
    return ghost.evaluate((el) => {
      const node = el as HTMLElement;
      node.style.setProperty("pointer-events", "auto", "important");
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return hit != null && node.contains(hit);
    });
  }

  for (const mode of ["Day", "Week", "Month"]) {
    test(`draws above the bottom bar in ${mode} mode`, async ({ page }) => {
      if (mode !== "Day") {
        await page.getByRole("tab", { name: mode }).click();
      }
      const bar = await page.getByRole("tab", { name: "Planner" }).boundingBox();
      if (bar == null) {
        throw new Error("the bottom bar has no box");
      }
      await holdDragTo(page, row(page, groceries), {
        x: bar.x + bar.width / 2,
        y: bar.y + bar.height / 2 + 20,
      });

      expect(await ghostIsOnTop(page)).toBe(true);
      await page.mouse.up();
    });
  }
});

test.describe("the source menu", () => {
  // An open menu hides the screen from assistive tech, so the role
  // locators miss the bottom bar. Each test reads its box first.
  test("a tap on the bottom bar closes it and does not navigate", async ({ page }) => {
    const lists = await page.getByRole("tab", { name: "Lists" }).boundingBox();
    if (lists == null) {
      throw new Error("the Lists tab has no box");
    }
    await openSourceMenu(page);
    await expect(page.getByText("Focus", { exact: true })).toBeVisible();

    await page.mouse.click(lists.x + lists.width / 2, lists.y + lists.height / 2);

    await expect(page.getByText("Focus", { exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(/planner/);
  });

  test.describe("on a small phone", () => {
    test.use({ viewport: { width: 360, height: 640 } });

    for (const mode of ["Day", "Week", "Month"]) {
      test(`opens fully above the bottom bar in ${mode} mode`, async ({ page }) => {
        if (mode !== "Day") {
          await page.getByRole("tab", { name: mode }).click();
        }
        const bar = await page.getByRole("tab", { name: "Planner" }).boundingBox();
        await expectToggleAboveBar(page);
        await openSourceMenu(page);
        const last = await page.getByText("Main", { exact: true }).boundingBox();
        if (last == null || bar == null) {
          throw new Error("the menu or the bottom bar has no box");
        }

        expect(last.y + last.height).toBeLessThanOrEqual(bar.y);
      });
    }
  });
});

test.describe("a day's order", () => {
  test("the day list sorts a recurring task by its time of day", async ({ page }) => {
    await page.getByRole("tab", { name: tomorrow.short, exact: true }).click();
    await expect(page.getByTestId("day-heading")).toContainText(tomorrow.heading);
    await addEarlyTask(page);

    await expectAbove(row(page, early.name), row(page, tomorrow.task));
    await expectAbove(row(page, tomorrow.task), row(page, supplements));
  });

  test("the month's picked day sorts the same way", async ({ page }) => {
    await page.getByRole("tab", { name: "Month", exact: true }).click();
    await addEarlyTask(page);
    await pickDay(page, tomorrow.heading);

    await expectAbove(row(page, early.name), row(page, tomorrow.task));
    await expectAbove(row(page, tomorrow.task), row(page, supplements));
  });

  test("the swipe preview sorts the same way", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === "reduced-motion",
      "with reduced motion the page does not follow the finger, so no preview shows",
    );
    await addEarlyTask(page);
    // Today's day page does not list it, so wait for the read in Week.
    await page.getByRole("tab", { name: "Week", exact: true }).click();
    await expect(row(page, early.name)).toBeVisible();
    await page.getByRole("tab", { name: "Day", exact: true }).click();
    await expect(page.getByTestId("day-heading")).toBeVisible();
    // The pager sizes itself from its own layout, one frame after the
    // page mounts. Wait for two frames rather than a wall-clock guess.
    await page.evaluate(
      () =>
        new Promise<void>((done) => {
          requestAnimationFrame(() => requestAnimationFrame(() => done()));
        }),
    );
    const heading = await page.getByTestId("day-heading").boundingBox();
    if (heading == null) {
      throw new Error("the day heading has no box");
    }
    const y = heading.y + heading.height / 2;
    await page.mouse.move(360, y);
    await page.mouse.down();
    await page.mouse.move(200, y + 2, { steps: 10 });

    // The preview is the page that sits right of the live one. Of the
    // places a name shows, the list row is the lowest.
    const lowest = (name: string) =>
      page
        .getByTestId("day-pager")
        .getByText(name)
        .evaluateAll((nodes) => {
          const boxes = nodes
            .map((node) => node.getBoundingClientRect())
            .filter((box) => box.left > 220);
          return Math.max(...boxes.map((box) => box.top));
        });
    // The preview paints a frame after the move.
    await expect.poll(() => lowest(early.name)).toBeGreaterThan(0);
    await expect.poll(() => lowest(tomorrow.task)).toBeGreaterThan(0);
    const morning = await lowest(early.name);
    const dentist = await lowest(tomorrow.task);
    const evening = await lowest(supplements);
    await page.mouse.up();

    expect(morning).toBeLessThan(dentist);
    expect(dentist).toBeLessThan(evening);
  });
});

test("the overdue rows have the list's hairline between them", async ({ page }) => {
  const group = page.getByTestId("overdue-group");
  await expect(group.getByTestId(`task-row:${overdue.name}`)).toBeVisible();

  await expect(group.getByTestId("row-separator")).toHaveCount(1);
});

test.describe("the source toggle names the period on screen", () => {
  test("day mode", async ({ page }) => {
    await expect(sourceToggle(page)).toHaveAccessibleName("task source: Due today");

    await page.getByRole("tab", { name: tomorrow.short, exact: true }).click();
    await expect(sourceToggle(page)).toHaveAccessibleName("task source: Due tomorrow");

    await page.getByRole("tab", { name: "Wed 28" }).click();
    await expect(sourceToggle(page)).toHaveAccessibleName(
      "task source: Due Wed, 28 Oct",
    );
  });

  test("week mode", async ({ page }) => {
    await page.getByRole("tab", { name: "Week", exact: true }).click();
    await expect(sourceToggle(page)).toHaveAccessibleName(
      "task source: Due this week",
    );

    // Weeks start on Sunday: 8 November 2026 is one.
    await page.getByRole("tab", { name: /week of Nov 8-14/ }).click();
    await expect(sourceToggle(page)).toHaveAccessibleName(
      "task source: Due 8 to 14 Nov",
    );
  });

  test("month mode", async ({ page }) => {
    await page.getByRole("tab", { name: "Month", exact: true }).click();
    await expect(sourceToggle(page)).toHaveAccessibleName(
      "task source: Due this month",
    );

    await page.getByRole("tab", { name: months.nextCell }).click();
    await expect(sourceToggle(page)).toHaveAccessibleName(
      "task source: Due November",
    );
  });
});

test.describe("a drop writes the day", () => {
  test("a list row dropped on a week column takes that day", async ({ page }) => {
    await page.getByRole("tab", { name: "Week", exact: true }).click();
    const column = page.getByRole("button", { name: tomorrow.short });

    await holdDrag(page, row(page, undated.second), column);

    await expect(column.getByText(undated.second)).toBeVisible();
  });

  test("a list row dropped on a month cell takes that day", async ({ page }) => {
    await page.getByRole("tab", { name: "Month", exact: true }).click();
    const cell = page.getByRole("gridcell", { name: "Wednesday 28" });

    await holdDrag(page, row(page, "Groceries: milk, eggs, oats"), cell);
    // The drop does not pick the cell. A press does, and lists the day.
    await cell.click();

    await expect(row(page, "Groceries: milk, eggs, oats")).toBeVisible();
    await expect(sectionHeader(page, "Wednesday 28")).toBeVisible();
  });
});

test("the month grid first paints where it settles", async ({ page }) => {
  // The observer runs before the browser paints, so it reads the box
  // of the first frame a user sees.
  await page.evaluate(() => {
    const seen = window as unknown as { firstCell?: { x: number; y: number } };
    new MutationObserver(() => {
      const cell = document.querySelector(
        '[data-testid="month-pager"] [aria-label^="Wednesday 28"]',
      );
      if (seen.firstCell == null && cell != null) {
        const box = cell.getBoundingClientRect();
        seen.firstCell = { x: box.x, y: box.y };
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("tab", { name: "Month", exact: true }).click();
  const cell = page.getByRole("gridcell", { name: "Wednesday 28" });
  await expect(cell).toBeVisible();
  // Give a late layout time to land before reading the settled box.
  await page.waitForTimeout(500);

  const first = await page.evaluate(
    () => (window as unknown as { firstCell?: { x: number; y: number } }).firstCell,
  );
  const settled = await cell.boundingBox();
  expect(first).toEqual({ x: settled?.x, y: settled?.y });
});

test("the month keeps its picked day after a visit to Day", async ({ page }) => {
  await page.getByRole("tab", { name: "Month", exact: true }).click();
  await pickDay(page, "Wednesday 28");
  await expect(sectionHeader(page, "Wednesday 28")).toBeVisible();

  await press(page, page.getByRole("button", { name: "open this day" }));
  await expect(page.getByTestId("day-heading")).toBeVisible();
  await page.getByRole("tab", { name: "Month", exact: true }).click();

  await expect(sectionHeader(page, "Wednesday 28")).toBeVisible();
  await expect(page.getByRole("button", { name: "open this day" })).toBeVisible();
});
