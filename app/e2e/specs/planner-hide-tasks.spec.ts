import type { Locator, Page } from "@playwright/test";
import { expect, pauseClock, test } from "../fixtures";
import { dragWith, press } from "../gestures";
import { noteText } from "../vault";

/**
 * Ticket 20261126-planner-hides-its-tasks: a tap on the split handle
 * hides the planner's task half, so the calendar takes the screen, and
 * a second tap shows it again. The choice is a setting, so it survives
 * a reload. Day, week and month all read it.
 */

const modes = [
  { mode: "Day", split: "day-split", shown: "resize timeline", card: "day-split:top" },
  { mode: "Week", split: "week-split", shown: "hide tasks", card: "week-view:spread" },
  { mode: "Month", split: "month-split", shown: "hide tasks", card: "month-pager" },
] as const;

type Mode = (typeof modes)[number];

async function openMode(page: Page, { mode, split }: Mode) {
  await page.goto("/planner");
  await expect(page.getByTestId("day-heading")).toBeVisible();
  if (mode !== "Day") {
    await page.getByRole("tab", { name: mode, exact: true }).click();
  }
  await expect(page.getByTestId(split)).toBeVisible();
  await expect(sourceToggle(page)).toBeVisible();
}

/** The handle in its hidden state: a slider that says so in Day, and a
    button named for the way back in Week and Month. */
function hiddenHandle(page: Page, { mode }: Mode) {
  return mode === "Day"
    ? page.getByRole("slider", { name: "resize timeline" })
    : page.getByRole("button", { name: "show tasks" });
}

/** The live source toggle: the first thing the task half draws. */
function sourceToggle(page: Page) {
  return page.getByRole("button", { name: /^task source:/ }).last();
}

async function height(page: Page, id: string): Promise<number> {
  return (await page.getByTestId(id).boundingBox())?.height ?? 0;
}

/**
 * Click the handle on a stopped clock, then step 24 frames of 16 ms and
 * read the height of `id` after each. The stopped clock makes the
 * frames the test's own, so a busy runner cannot skip the middle ones.
 */
async function clickAndStep(page: Page, grip: Locator, id: string): Promise<number[]> {
  const box = (await grip.boundingBox())!;
  await pauseClock(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const heights: number[] = [];
  for (let frame = 0; frame < 24; frame += 1) {
    await page.clock.runFor(16);
    heights.push(await height(page, id));
  }
  await page.clock.resume();
  return heights;
}

for (const entry of modes) {
  const { mode, split, shown } = entry;

  test.describe(`${mode}: hiding the task half`, () => {
    test("a tap on the handle hands the list's room to the calendar, and a second tap takes it back", async ({
      page,
    }) => {
      await openMode(page, entry);
      const grip = page.getByTestId(`${split}:grip`);
      const topBefore = await height(page, `${split}:top`);
      const bottomBefore = await height(page, `${split}:bottom`);
      expect(bottomBefore).toBeGreaterThan(60);

      await grip.click();

      await expect
        .poll(() => height(page, `${split}:bottom`))
        .toBeLessThanOrEqual(1);
      await expect(page.getByRole("button", { name: /^task source:/ })).toHaveCount(0);
      const topAfter = await height(page, `${split}:top`);
      expect(Math.abs(topAfter - (topBefore + bottomBefore))).toBeLessThanOrEqual(2);
      if (mode !== "Day") {
        const card = await height(page, entry.card);
        expect(card).toBeGreaterThanOrEqual(topAfter - 2);
      }

      // The handle stays above the bottom bar, as the way back.
      const handle = await grip.boundingBox();
      const bar = await page.getByRole("tab", { name: "Planner" }).boundingBox();
      expect(handle).not.toBeNull();
      expect((handle?.y ?? 0) + (handle?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0);
      await expect(hiddenHandle(page, entry)).toBeVisible();
      if (mode === "Day") {
        await expect(hiddenHandle(page, entry)).toHaveAttribute("aria-valuetext", "tasks hidden");
      }

      await grip.click();

      await expect(sourceToggle(page)).toBeVisible();
      await expect
        .poll(async () => Math.abs((await height(page, `${split}:top`)) - topBefore))
        .toBeLessThanOrEqual(2);
      await expect
        .poll(async () => Math.abs((await height(page, `${split}:bottom`)) - bottomBefore))
        .toBeLessThanOrEqual(2);
      if (mode === "Day") {
        await expect(page.getByRole("slider", { name: shown })).toBeVisible();
      } else {
        await expect(page.getByRole("button", { name: shown })).toBeVisible();
      }
    });

    test("the hide plays over the settle clock, or lands at once with reduced motion", async ({
      page,
      reducedMotion,
    }) => {
      await openMode(page, entry);
      const bottomBefore = await height(page, `${split}:bottom`);
      const grip = page.getByTestId(`${split}:grip`);

      const hidden = await clickAndStep(page, grip, `${split}:bottom`);
      const between = hidden.filter((h) => h > 1 && h < bottomBefore - 1);
      expect(hidden.at(-1)).toBeLessThanOrEqual(1);
      if (reducedMotion === "reduce") {
        expect(between).toEqual([]);
      } else {
        expect(between.length).toBeGreaterThan(2);
        expect([...hidden].sort((a, b) => b - a)).toEqual(hidden);
      }

      const back = await clickAndStep(page, grip, `${split}:bottom`);
      const during = back.filter((h) => h > 1 && h < bottomBefore - 1);
      expect(Math.abs((back.at(-1) ?? 0) - bottomBefore)).toBeLessThanOrEqual(2);
      if (reducedMotion === "reduce") {
        expect(during).toEqual([]);
      } else {
        expect(during.length).toBeGreaterThan(2);
        expect([...back].sort((a, b) => a - b)).toEqual(back);
      }
    });

    test("the choice survives a reload, in both directions", async ({ page }) => {
      await openMode(page, entry);
      await page.getByTestId(`${split}:grip`).click();
      await expect
        .poll(() => height(page, `${split}:bottom`))
        .toBeLessThanOrEqual(1);

      await page.reload();
      await expect(page.getByTestId(split)).toBeVisible();
      await expect(hiddenHandle(page, entry)).toBeVisible();
      await expect(page.getByRole("button", { name: /^task source:/ })).toHaveCount(0);
      expect(await height(page, `${split}:bottom`)).toBeLessThanOrEqual(1);

      await page.getByTestId(`${split}:grip`).click();
      await expect(sourceToggle(page)).toBeVisible();

      await page.reload();
      await expect(page.getByTestId(split)).toBeVisible();
      await expect(sourceToggle(page)).toBeVisible();
    });

    test("Enter on the focused handle hides and shows", async ({ page }) => {
      await openMode(page, entry);
      const grip = page.getByTestId(`${split}:grip`);
      await grip.focus();

      await page.keyboard.press("Enter");
      await expect(hiddenHandle(page, entry)).toBeVisible();
      await expect(page.getByRole("button", { name: /^task source:/ })).toHaveCount(0);
      await expect(grip).toBeFocused();

      await page.keyboard.press("Enter");
      await expect(sourceToggle(page)).toBeVisible();
      await expect(grip).toBeFocused();
    });
  });
}

test("the day split still drags with the task half shown, and a hide keeps its place", async ({
  page,
}) => {
  await openMode(page, modes[0]);
  const grip = page.getByTestId("day-split:grip");
  const top = page.getByTestId("day-split:top");
  const before = (await top.boundingBox())?.height ?? 0;
  const box = (await grip.boundingBox())!;

  const pointer = await press(page, "mouse", grip, { holdMs: 0 });
  await pointer.moveTo({ x: box.x + box.width / 2, y: box.y + box.height / 2 + 80 });
  await pointer.up();
  await expect
    .poll(async () => ((await top.boundingBox())?.height ?? 0) - before)
    .toBeGreaterThan(60);
  await expect(grip).not.toHaveAttribute("aria-valuetext", "tasks hidden");
  const dragged = (await top.boundingBox())?.height ?? 0;

  await grip.click();
  await expect(grip).toHaveAttribute("aria-valuetext", "tasks hidden");
  await expect
    .poll(async () => (await height(page, "day-split:bottom")))
    .toBeLessThanOrEqual(1);
  await grip.click();
  await expect(sourceToggle(page)).toBeVisible();
  await expect
    .poll(async () => Math.abs(((await top.boundingBox())?.height ?? 0) - dragged))
    .toBeLessThanOrEqual(2);

  const again = (await grip.boundingBox())!;
  const second = await press(page, "mouse", grip, { holdMs: 0 });
  await second.moveTo({ x: again.x + again.width / 2, y: again.y + again.height / 2 - 60 });
  await second.up();
  await expect
    .poll(async () => dragged - ((await top.boundingBox())?.height ?? 0))
    .toBeGreaterThan(40);
});

test("a hidden list leaves the week on one screen, and a chip still drops on its day", async ({
  page,
}) => {
  await openMode(page, modes[1]);
  await page.getByTestId("week-split:grip").click();
  await expect.poll(() => height(page, "week-split:bottom")).toBeLessThanOrEqual(1);

  const bar = await page.getByRole("tab", { name: "Planner" }).boundingBox();
  const viewport = page.viewportSize();
  const days = page.locator('[data-testid^="week-day:"]');
  await expect(days).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    const box = (await days.nth(index).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport?.width ?? 0);
    expect(box.y + box.height).toBeLessThanOrEqual(bar?.y ?? 0);
  }

  const chip = page.getByTestId("week-task:Dentist appointment");
  await dragWith(page, "mouse", chip, page.getByTestId("week-day:2026-10-29"));
  await expect
    .poll(() => noteText(page, "Tasks/Dentist appointment.md"))
    .toContain("due: 2026-10-29T14:30");
});
