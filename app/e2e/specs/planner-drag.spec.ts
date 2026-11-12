import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { overdue, supplements, undated } from "../data";
import {
  cancelTouch,
  dragWith,
  expectTouchAction,
  pointOn,
  press,
  scrollTopOf,
  touchFlick,
  type Input,
} from "../gestures";
import { row, sectionHeader } from "../locators";
import { noteText, putNote, returnToTab } from "../vault";

/**
 * Ticket 0061: drag to schedule and the split grabber on the UI thread.
 * Every scenario runs with the mouse and with CDP touch. A scenario
 * that only a touch can show says so in its title.
 */

const inputs: Input[] = ["mouse", "touch"];

/** A task due today at 10:25: its minute must survive a drop. */
const timed = {
  name: "Review budget",
  path: "Tasks/Review budget.md",
  text: '---\nkind: "[[tasks]]"\ncreated: 2026-10-26T09:00\ndue: 2026-10-26T10:25\n---\n',
} as const;

/** A task another app adds while a finger is down. */
const added = {
  name: "Book a haircut",
  path: "Tasks/Book a haircut.md",
  text: '---\nkind: "[[tasks]]"\ncreated: 2026-10-26T09:00\ndue: 2026-10-26\n---\n',
} as const;

const overdueNote = "Tasks/Return library books.md";
const supplementsNote = "Tasks/Supplements.md";

async function openPlanner(page: Page) {
  await page.goto("/planner");
  await expect(page.getByTestId("day-heading")).toBeVisible();
}

/** Add the 10:25 task and wait for its row, as a sync from another app. */
async function addTimed(page: Page) {
  await putNote(page, timed.path, timed.text);
  await returnToTab(page);
  await expect(row(page, timed.name)).toBeVisible();
}

/** The grab offset a ghost must keep: the finger's place in its source. */
async function grabOf(page: Page, testID: string) {
  const box = await page.getByTestId(testID).boundingBox();
  if (box == null) {
    throw new Error(`${testID} has no box`);
  }
  return { width: box.width, height: box.height, dx: box.width / 2, dy: box.height / 2 };
}

/** True when the ghost's translate sits within `slack` px of the finger.
    The surface scales the ghost by 3% around its centre, so the box it
    paints is not the translate it carries; the matrix's e and f are. */
async function expectGhostOnPointer(page: Page, point: { x: number; y: number }, dx: number, dy: number) {
  await expect
    .poll(async () =>
      page.evaluate(
        ({ x, y, dx, dy }) => {
          const ghost = document.querySelector('[data-testid="drag-ghost"]');
          if (ghost == null) {
            return Number.POSITIVE_INFINITY;
          }
          const matrix = new DOMMatrixReadOnly(getComputedStyle(ghost).transform);
          return Math.hypot(matrix.e - (x - dx), matrix.f - (y - dy));
        },
        { x: point.x, y: point.y, dx, dy },
      ),
    )
    .toBeLessThanOrEqual(4);
}

async function hoverOpacity(page: Page, testID: string): Promise<number> {
  return page.evaluate((id) => {
    const zone = document.querySelector(`[data-testid="${id}"]`);
    const fill = zone?.firstElementChild;
    return fill == null ? 0 : Number(getComputedStyle(fill).opacity);
  }, testID);
}

async function sampleTransform(page: Page, testID: string, frames: number): Promise<string[]> {
  return page.evaluate(
    async ({ id, frames }) => {
      const element = document.querySelector(`[data-testid="${id}"]`);
      const out: string[] = [];
      for (let i = 0; i < frames; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        out.push(element == null ? "" : getComputedStyle(element).transform);
      }
      return out;
    },
    { id: testID, frames },
  );
}

const restingTransforms = ["none", "matrix(1, 0, 0, 1, 0, 0)"];

test("a row, a pill and an hour task keep pan-y, and the grabber takes none", async ({ page }) => {
  await openPlanner(page);
  await expectTouchAction(page.getByTestId(`task-source:${overdue.name}`), "pan-y");
  await expectTouchAction(page.getByTestId("hour-task:Supplements"), "pan-y");
  await expectTouchAction(page.getByTestId("day-split:grip"), "none");

  await page.getByRole("tab", { name: "Week", exact: true }).click();
  await page.getByRole("tab", { name: "pill form" }).click();
  await expectTouchAction(page.getByTestId(`pill:${undated.second}`), "pan-y");
});

test.describe("a scroll that starts on a row", () => {
  test("a fast touch drag of 200 px shows no hold tint", async ({ page }) => {
    await openPlanner(page);
    const source = page.getByTestId(`task-source:${overdue.name}`);
    await source.scrollIntoViewIfNeeded();

    await page.evaluate((id) => {
      const seen = window as unknown as { tints: number[]; stop: () => void };
      seen.tints = [];
      let live = true;
      seen.stop = () => {
        live = false;
      };
      const sample = () => {
        const element = document.querySelector(`[data-testid="${id}"]`);
        const tint = element?.firstElementChild;
        if (tint != null) {
          seen.tints.push(Number(getComputedStyle(tint).opacity));
        }
        if (live) {
          requestAnimationFrame(sample);
        }
      };
      requestAnimationFrame(sample);
    }, `task-source:${overdue.name}`);

    await touchFlick(page, source, 200, { waitMs: 10 });

    const tints = await page.evaluate(() => {
      const seen = window as unknown as { tints: number[]; stop: () => void };
      seen.stop();
      return seen.tints;
    });
    expect(tints.length).toBeGreaterThan(5);
    expect(Math.max(...tints)).toBeLessThan(0.05);
  });
});

for (const input of inputs) {
  test.describe(`with the ${input}`, () => {
    test("a held row dropped on 2 PM keeps its minute and its ghost keeps the finger", async ({ page }) => {
      await openPlanner(page);
      await addTimed(page);
      const source = page.getByTestId(`task-source:${timed.name}`);
      await source.scrollIntoViewIfNeeded();
      const grab = await grabOf(page, `task-source:${timed.name}`);
      const target = page.getByTestId("timeline-hour:14");
      const targetPoint = await pointOn(page, target);

      const pointer = await press(page, input, source, { holdMs: 400 });
      await pointer.moveTo(targetPoint);

      await expect.poll(() => hoverOpacity(page, "timeline-hour:14")).toBeGreaterThan(0.9);
      await expectGhostOnPointer(page, targetPoint, grab.dx, grab.dy);
      await pointer.up();

      await expect.poll(() => noteText(page, timed.path)).toContain("due: 2026-10-26T14:25");
      await expect(page.getByTestId("timeline-hour:14")).toContainText("2:25 PM");
    });

    test("a held hour task moves to another hour", async ({ page }) => {
      await openPlanner(page);
      await addTimed(page);
      const source = page.getByTestId(`hour-task:${timed.name}`);
      const target = page.getByTestId("timeline-hour:13");
      await expect(source).toBeVisible();

      await dragWith(page, input, source, target);

      await expect.poll(() => noteText(page, timed.path)).toContain("due: 2026-10-26T13:25");
      await expect(page.getByTestId("timeline-hour:13")).toContainText("1:25 PM");
    });

    test("an hour task released at 150 ms lifts nothing", async ({ page }) => {
      await openPlanner(page);
      await addTimed(page);
      const source = page.getByTestId(`hour-task:${timed.name}`);
      const target = page.getByTestId("timeline-hour:13");
      await expect(source).toBeVisible();

      const pointer = await press(page, input, source, { holdMs: 150, paused: true });
      await pointer.moveTo(await pointOn(page, target));
      await pointer.up();
      await page.clock.resume();
      await page.waitForTimeout(200);

      expect(await noteText(page, timed.path)).toContain("due: 2026-10-26T10:25");
      await expect(page.getByTestId("drag-ghost")).toHaveCount(0);
    });

    test("a tap 100 ms after a drop still ticks the row", async ({ page }) => {
      await openPlanner(page);
      const source = page.getByTestId(`task-source:${overdue.name}`);
      await source.scrollIntoViewIfNeeded();
      await dragWith(page, input, source, page.getByTestId(`timeline-hour:${overdue.dropHour}`));

      await page.waitForTimeout(100);
      await row(page, overdue.name)
        .getByRole("checkbox")
        .click();

      await expect
        .poll(() => noteText(page, overdueNote))
        .toContain("completed: 2026-10-26T");
    });

    test("a drop back on its own row opens no editor", async ({ page }) => {
      await openPlanner(page);
      const source = page.getByTestId(`task-source:${overdue.name}`);
      await source.scrollIntoViewIfNeeded();
      const point = await pointOn(page, source);

      const pointer = await press(page, input, source, { holdMs: 400 });
      await pointer.moveTo({ x: point.x + 20, y: point.y + 40 });
      await pointer.moveTo(point);
      await pointer.up();
      await page.waitForTimeout(300);

      expect(new URL(page.url()).pathname).toBe("/planner");
    });

    test("a pill dropped on Thursday keeps its time", async ({ page }) => {
      await openPlanner(page);
      await page.getByRole("tab", { name: "Week", exact: true }).click();
      await page.getByRole("tab", { name: "pill form" }).click();
      const pill = page.getByTestId(`pill:${supplements}`);
      await expect(pill).toBeVisible();

      await dragWith(page, input, pill, page.getByRole("button", { name: "Thu 29" }));

      await expect.poll(() => noteText(page, supplementsNote)).toContain("due: 2026-10-29T19:00");
      await expect(pill).toContainText("Oct 29");
    });

    test("a row dropped on a month cell keeps its time and opens no day", async ({ page }) => {
      await openPlanner(page);
      await page.getByRole("tab", { name: "Month", exact: true }).click();
      const source = page.getByTestId(`task-source:${supplements}`);
      await expect(source).toBeVisible();
      const cell = page.getByRole("gridcell", { name: "Wednesday 28" });

      await dragWith(page, input, source, cell);

      await expect.poll(() => noteText(page, supplementsNote)).toContain("due: 2026-10-28T19:00");
      await expect(sectionHeader(page, "Wednesday 28")).toHaveCount(0);

      await cell.click();
      await expect(sectionHeader(page, "Wednesday 28")).toBeVisible();
    });

    test("a release over no zone writes nothing", async ({ page }) => {
      await openPlanner(page);
      const before = await noteText(page, overdueNote);
      const source = page.getByTestId(`task-source:${overdue.name}`);
      await source.scrollIntoViewIfNeeded();

      const pointer = await press(page, input, source, { holdMs: 400 });
      await pointer.moveTo(await pointOn(page, page.getByRole("tab", { name: "Planner" })));
      await pointer.up();

      await expect(page.getByTestId("drag-ghost")).toHaveCount(0);
      expect(await noteText(page, overdueNote)).toBe(before);
    });

    test("a store write mid-drag does not drop it", async ({ page }) => {
      await openPlanner(page);
      const source = page.getByTestId(`task-source:${overdue.name}`);
      await source.scrollIntoViewIfNeeded();
      const pointer = await press(page, input, source, { holdMs: 400 });

      await putNote(page, added.path, added.text);
      await returnToTab(page);
      await expect(row(page, added.name)).toBeVisible();

      await pointer.moveTo(await pointOn(page, page.getByTestId(`timeline-hour:${overdue.dropHour}`)));
      await pointer.up();

      await expect.poll(() => noteText(page, overdueNote)).toContain(
        `due: 2026-10-26T${String(overdue.dropHour).padStart(2, "0")}:00`,
      );
    });

    test("the grabber follows the finger and stops at its limit", async ({ page }) => {
      await openPlanner(page);
      const split = page.getByTestId("day-split");
      const top = page.getByTestId("day-split:top");
      const grip = page.getByTestId("day-split:grip");
      const splitBox = await split.boundingBox();
      if (splitBox == null) {
        throw new Error("the split has no box");
      }
      const start = (await top.boundingBox())?.height ?? 0;
      const point = await pointOn(page, grip);

      const pointer = await press(page, input, grip, { holdMs: 0 });
      await pointer.moveTo({ x: point.x, y: point.y + 120 });
      await expect.poll(async () => ((await top.boundingBox())?.height ?? 0) - start).toBeGreaterThan(100);

      await pointer.moveTo({ x: point.x, y: point.y + 1200 });
      const limit = splitBox.height - 28 - 150;
      await expect
        .poll(async () => Math.abs(((await top.boundingBox())?.height ?? 0) - limit))
        .toBeLessThanOrEqual(2);
      await pointer.up();

      await page.waitForTimeout(300);
      expect(Math.abs(((await top.boundingBox())?.height ?? 0) - limit)).toBeLessThanOrEqual(2);
    });
  });
}

test("a touch that moves before its hold scrolls the pane and lifts nothing", async ({ page }) => {
  await openPlanner(page);
  await addTimed(page);
  const source = page.getByTestId(`hour-task:${timed.name}`);
  const marker = page.getByTestId("timeline-hour:7");
  await expect(source).toBeVisible();
  expect(await scrollTopOf(marker)).toBe(0);

  await touchFlick(page, source, -100);

  await expect.poll(() => scrollTopOf(marker)).toBeGreaterThan(0);
  await expect(page.getByTestId("drag-ghost")).toHaveCount(0);
});

test("a touch that holds then moves drags, and the pane holds still", async ({ page }) => {
  await openPlanner(page);
  await addTimed(page);
  const source = page.getByTestId(`hour-task:${timed.name}`);
  const marker = page.getByTestId("timeline-hour:7");
  const before = await noteText(page, timed.path);
  await expect(source).toBeVisible();
  const point = await pointOn(page, source);

  const pointer = await press(page, "touch", source, { holdMs: 400 });
  await pointer.moveTo({ x: point.x, y: point.y - 100 });
  await expect(page.getByTestId("drag-ghost")).toBeVisible();
  expect(await scrollTopOf(marker)).toBe(0);

  await cancelTouch(pointer);
  expect(await scrollTopOf(marker)).toBe(0);
  expect(await noteText(page, timed.path)).toBe(before);
});

for (const input of inputs) {
  test.describe(`reduce motion, with the ${input}`, () => {
    test("the source does not shake, and the drag and the grabber still follow", async ({ page, reducedMotion }) => {
      test.skip(reducedMotion !== "reduce", "the motion project plays the shake");
      await openPlanner(page);
      const source = page.getByTestId(`task-source:${overdue.name}`);
      await source.scrollIntoViewIfNeeded();
      const grab = await grabOf(page, `task-source:${overdue.name}`);
      const target = page.getByTestId(`timeline-hour:${overdue.dropHour}`);
      const targetPoint = await pointOn(page, target);

      const pointer = await press(page, input, source, { holdMs: 400 });
      await pointer.moveTo(targetPoint);

      const samples = await sampleTransform(page, `task-source:${overdue.name}`, 12);
      expect(samples.every((sample) => restingTransforms.includes(sample))).toBe(true);
      await expectGhostOnPointer(page, targetPoint, grab.dx, grab.dy);
      await pointer.up();

      const top = page.getByTestId("day-split:top");
      const grip = page.getByTestId("day-split:grip");
      const start = (await top.boundingBox())?.height ?? 0;
      const gripPoint = await pointOn(page, grip);
      const resize = await press(page, input, grip, { holdMs: 0 });
      await resize.moveTo({ x: gripPoint.x, y: gripPoint.y + 60 });
      await expect.poll(async () => ((await top.boundingBox())?.height ?? 0) - start).toBeGreaterThan(40);
      await resize.up();
    });
  });
}

test("the source shakes once when it lifts, with motion on", async ({ page, reducedMotion }) => {
  test.skip(reducedMotion === "reduce", "the reduced-motion project checks the other half");
  await openPlanner(page);
  const source = page.getByTestId(`task-source:${overdue.name}`);
  await source.scrollIntoViewIfNeeded();
  const target = page.getByTestId(`timeline-hour:${overdue.dropHour}`);

  const pointer = await press(page, "mouse", source, { holdMs: 400 });

  const samples = await sampleTransform(page, `task-source:${overdue.name}`, 12);
  expect(samples.some((sample) => !restingTransforms.includes(sample))).toBe(true);
  await pointer.moveTo(await pointOn(page, target));
  await pointer.up();
});

test("a touch drag that ends in touchCancel writes nothing", async ({ page }) => {
  await openPlanner(page);
  const before = await noteText(page, overdueNote);
  const source = page.getByTestId(`task-source:${overdue.name}`);
  await source.scrollIntoViewIfNeeded();

  const pointer = await press(page, "touch", source, { holdMs: 400 });
  await pointer.moveTo(await pointOn(page, page.getByTestId(`timeline-hour:${overdue.dropHour}`)));
  await cancelTouch(pointer);

  await expect(page.getByTestId("drag-ghost")).toHaveCount(0);
  expect(await noteText(page, overdueNote)).toBe(before);
});
