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
  await page.getByRole("tab", { name: "Month" }).click();
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
    await page.getByRole("tab", { name: "Week" }).click();
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
    const column = page.getByRole("button", { name: tomorrow.heading, exact: true });

    await expectAbove(
      column.getByText(tomorrow.task),
      column.getByText(supplements),
    );
  });
});
