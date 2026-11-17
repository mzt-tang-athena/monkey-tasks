import { expect, test } from "../fixtures";
import { broken, months, overdue, supplements, tomorrow, undated } from "../data";
import { holdDrag, swipe } from "../gestures";
import { expectAbove, row } from "../locators";

test.beforeEach(async ({ page }) => {
  await page.goto("/planner");
  await expect(page.getByTestId("day-heading")).toBeVisible();
});

test("a swipe left on the day turns to the next day", async ({ page }) => {
  await swipe(page, page.getByTestId("day-heading"), "left");

  await expect(page.getByTestId("day-heading")).toContainText(tomorrow.heading);
  // The live day draws its own ruler. The swipe preview draws one too,
  // with no test ids, so this finds the live hour only.
  const hour = page.getByTestId(`timeline-hour:${tomorrow.hour}`);
  await expect(hour).toContainText(tomorrow.task);
  await expect(hour).toContainText(tomorrow.time);
});

test("a swipe left on the month turns to the next month", async ({ page }) => {
  await page.getByRole("tab", { name: "Month", exact: true }).click();
  const title = page.getByTestId("month-title");
  await expect(title).toHaveText(months.current);

  await swipe(page, page.getByTestId("month-pager"), "left");

  await expect(title).toHaveText(months.next);
});

test("a task dropped on an hour takes that time", async ({ page }) => {
  const hour = page.getByTestId(`timeline-hour:${overdue.dropHour}`);

  await holdDrag(page, row(page, overdue.name), hour, { holdMs: 450 });

  await expect(hour).toContainText(overdue.name);
  await expect(hour).toContainText(overdue.dropTime);
  // The day list keeps the row, now due today at that time.
  const listed = row(page, overdue.name);
  await expect(listed).toContainText(overdue.dropTime);
  await expect(listed).not.toContainText("overdue");
});

test.describe("week", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("tab", { name: "Week", exact: true }).click();
    await expect(row(page, undated.second)).toBeVisible();
  });

  test("the week list leaves out a note that needs repair", async ({ page }) => {
    // The Lists screen shows a broken note in its repair block and
    // never as a row. The planner must not offer it as a task.
    await expect(row(page, broken)).toHaveCount(0);
  });

  test("a day column lists its tasks in time order", async ({ page }) => {
    // The daily task is stored on TODAY, in the evening. On the next
    // day its occurrence must still sort after the afternoon task.
    const column = page.getByRole("button", { name: tomorrow.short });

    await expectAbove(
      column.getByText(tomorrow.task),
      column.getByText(supplements),
    );
  });
});

test("the timeline tick is a checkbox named by its task", async ({ page }) => {
  const chip = page.getByTestId(`hour-task:${supplements}`);
  const tick = chip.getByRole("checkbox", { name: supplements });
  await expect(tick).toHaveAttribute("aria-checked", "false");

  await tick.click();

  await expect(
    page.getByTestId(`hour-task:${supplements}`).getByRole("checkbox", {
      name: supplements,
    }),
  ).toHaveAttribute("aria-checked", "true");
});

test.describe("the week on a 360pt screen", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  for (const layout of ["spread", "rows"] as const) {
    test(`shows all seven days in ${layout}, with no sideways scroll`, async ({ page }) => {
      await page.addInitScript((value) => {
        globalThis.localStorage.setItem("monkey-tasks.week-view", value);
      }, layout);
      await page.goto("/planner");
      await page.getByRole("tab", { name: "Week", exact: true }).click();
      await expect(page.getByTestId(`week-view:${layout}`)).toBeVisible();

      const days = page.getByTestId(/^week-day:/);
      await expect(days).toHaveCount(7);
      for (let index = 0; index < 7; index += 1) {
        await expect(days.nth(index)).toBeVisible();
      }

      // Saturday stands on screen with no scroll, inside the window.
      const saturday = await page.getByTestId("week-day:2026-10-31").boundingBox();
      expect(saturday).not.toBeNull();
      expect(saturday!.x).toBeGreaterThanOrEqual(0);
      expect(saturday!.x + saturday!.width).toBeLessThanOrEqual(360);

      // Nothing overflows the page or the pager sideways.
      const widths = await page.evaluate(() => {
        const pager = document.querySelector('[data-testid="week-pager"]');
        return {
          page: document.documentElement.scrollWidth,
          window: window.innerWidth,
          pager: pager?.scrollWidth ?? 0,
          pagerBox: pager?.clientWidth ?? 0,
        };
      });
      expect(widths.page).toBeLessThanOrEqual(widths.window);
      expect(widths.pager).toBeLessThanOrEqual(widths.pagerBox);
    });
  }
});
