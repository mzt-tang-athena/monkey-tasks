import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect, test } from "../fixtures";
import { completedNotes, undated } from "../data";
import { openCompleted, press, row, openMain } from "../locators";

type Watched = { burstSeen?: boolean };

type Box = { left: number; top: number; right: number; bottom: number };

type BurstWatch = { boxes?: Box[]; bar?: Box | null };

/** Two boxes share area. Touching edges do not count. */
function overlaps(one: Box, other: Box) {
  return (
    Math.min(one.right, other.right) > Math.max(one.left, other.left) &&
    Math.min(one.bottom, other.bottom) > Math.max(one.top, other.top)
  );
}

/**
 * Records the box every burst paints into, as the page saw it at the
 * mount, and the bar's box. A box is cut by each ancestor that clips,
 * so it reads the area that can paint, not the layout the element
 * would have without the clip.
 */
async function watchBurstBoxes(page: Page) {
  await page.evaluate(() => {
    const watched = window as unknown as BurstWatch;
    watched.boxes = [];

    const asBox = (rect: DOMRect): Box => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });

    const clipped = (element: Element): Box => {
      const own = element.getBoundingClientRect();
      let box: Box = asBox(own);
      let node = element.parentElement;
      while (node != null) {
        const style = getComputedStyle(node);
        const clips = [style.overflowX, style.overflowY].some(
          (value) =>
            value === "hidden" ||
            value === "clip" ||
            value === "scroll" ||
            value === "auto",
        );
        if (clips) {
          const frame = node.getBoundingClientRect();
          box = {
            left: Math.max(box.left, frame.left),
            top: Math.max(box.top, frame.top),
            right: Math.min(box.right, frame.right),
            bottom: Math.min(box.bottom, frame.bottom),
          };
        }
        node = node.parentElement;
      }
      return box;
    };

    const bar = document.querySelector('[data-testid="bottom-bar"]');
    watched.bar = bar == null ? null : asBox(bar.getBoundingClientRect());

    const seen = new WeakSet<Element>();
    const record = () => {
      for (const burst of document.querySelectorAll(
        '[data-testid="tick-burst"]',
      )) {
        if (seen.has(burst)) {
          continue;
        }
        seen.add(burst);
        watched.boxes!.push(clipped(burst));
      }
    };
    record();
    new MutationObserver(record).observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

async function burstBoxes(page: Page) {
  return page.evaluate(() => {
    const watched = window as unknown as BurstWatch;
    return { boxes: watched.boxes ?? [], bar: watched.bar ?? null };
  });
}

/**
 * Scrolls the list so the tick's circle sits just above the bar. A
 * page tick near the bar is the case the burst must not cross.
 */
async function placeTickAboveBar(page: Page, tick: Locator, bar: Locator) {
  const barBox = await bar.boundingBox();
  if (barBox == null) {
    throw new Error("the bottom bar has no box");
  }
  const target = barBox.y - 12;
  for (let pass = 0; pass < 4; pass++) {
    const box = await tick.boundingBox();
    if (box == null) {
      throw new Error("the tick has no box");
    }
    const delta = box.y + box.height / 2 - target;
    if (Math.abs(delta) <= 1) {
      return;
    }
    await tick.evaluate((element, by) => {
      let node = element.parentElement;
      while (node != null && node !== document.body) {
        const style = getComputedStyle(node);
        const scrolls =
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight;
        if (scrolls) {
          node.scrollTop += by;
          return;
        }
        node = node.parentElement;
      }
      throw new Error("the tick has no scrolling ancestor");
    }, delta);
    await page.waitForTimeout(50);
  }
  const box = await tick.boundingBox();
  expect(box == null ? Number.NaN : box.y + box.height / 2).toBeLessThan(
    barBox.y,
  );
}

/**
 * The tick's burst draws above the row, because a ticked row moves to
 * Completed after the tick's 320 ms (ADR 0034). The burst runs for
 * 520 ms, outlives the row, and then removes itself. With reduced
 * motion it never mounts.
 *
 * A watch on the document records the mount. A press resolves well
 * after the event, and on a slow runner the burst can be gone by the
 * first read, so the check reads what the page saw, not what stands.
 */
async function watchBurst(page: Page) {
  await page.evaluate(() => {
    const watched = window as unknown as Watched;
    watched.burstSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="tick-burst"]') != null) {
        watched.burstSeen = true;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

async function burstSeen(page: Page) {
  return page.evaluate(
    () => (window as unknown as Watched).burstSeen === true,
  );
}

/** The run saw one burst and then none, or no burst at all under
    reduced motion. */
async function expectBurstRule(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name === "reduced-motion") {
    // A burst would still stand at 150 ms. The watch would have seen
    // one mount at any point before this read.
    await page.waitForTimeout(150);
    expect(await burstSeen(page)).toBe(false);
    await page.waitForTimeout(600);
    await expect(page.getByTestId("tick-burst")).toHaveCount(0);
    return;
  }

  await expect.poll(() => burstSeen(page)).toBe(true);
  await expect(page.getByTestId("tick-burst")).toHaveCount(0, {
    timeout: 2500,
  });
}

test.describe("completion celebration", () => {
  test("a tick plays one burst, and it clears itself", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await openMain(page);
    const tick = row(page, undated.second).getByRole("checkbox", {
      name: undated.second,
    });
    await expect(tick).toHaveAttribute("aria-checked", "false");
    // Completed folds by default, so open it and the ticked row stays on
    // the page while the burst plays.
    await openCompleted(page);
    await watchBurst(page);

    await press(page, tick);
    await expect(tick).toHaveAttribute("aria-checked", "true");

    await expectBurstRule(page, testInfo);
  });

  test("a page tick's burst never paints over the bottom bar", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await openMain(page);
    const tick = row(page, undated.second).getByRole("checkbox", {
      name: undated.second,
    });
    const bar = page.getByTestId("bottom-bar");
    await expect(tick).toHaveAttribute("aria-checked", "false");
    await expect(bar).toBeVisible();
    // Completed folds by default. Open it so the ticked row stays on the
    // page and keeps its box after the tick.
    await openCompleted(page);
    // A row near the bar is the case in the report: the row sits above
    // the bar, and the burst reaches past it.
    await placeTickAboveBar(page, tick, bar);
    await watchBurstBoxes(page);

    await press(page, tick);
    await expect(tick).toHaveAttribute("aria-checked", "true");

    if (testInfo.project.name === "reduced-motion") {
      await page.waitForTimeout(150);
      const { boxes } = await burstBoxes(page);
      expect(boxes).toHaveLength(0);
      await expect(page.getByTestId("tick-burst")).toHaveCount(0);
      return;
    }

    await expect
      .poll(async () => (await burstBoxes(page)).boxes.length)
      .toBeGreaterThan(0);
    const { boxes, bar: barBox } = await burstBoxes(page);
    expect(barBox).not.toBeNull();
    for (const box of boxes) {
      expect(overlaps(box, barBox!)).toBe(false);
    }
  });

  test("a mark done in the editor sheet plays a burst, and it clears", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await openMain(page);
    // Open the group first: the sheet is modal, so the page behind it
    // takes no press, and the row must stay on the page after the tick.
    await openCompleted(page);
    const target = row(page, undated.first);
    await press(page, target.getByRole("button", { name: undated.first }));
    const editor = page.getByRole("dialog", { name: "Task" });
    const mark = editor.getByRole("button", { name: "mark done" });
    await expect(mark).toBeVisible();
    await watchBurst(page);

    await press(page, mark);
    await expect(target.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await expectBurstRule(page, testInfo);
  });

  test("a sheet that reopens a done task plays no burst", async ({
    page,
  }) => {
    await page.goto("/");
    await openMain(page);
    // A done task sits in the folded Completed group until it opens.
    await openCompleted(page);
    const target = row(page, completedNotes.timed);
    await press(page, target.getByRole("button", { name: completedNotes.timed }));
    const editor = page.getByRole("dialog", { name: "Task" });
    const reopen = editor.getByRole("button", { name: "mark not done" });
    await expect(reopen).toBeVisible();
    await watchBurst(page);

    await press(page, reopen);
    await expect(target.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "false",
    );

    // No project reduces motion here: the sheet's tick never plays on a
    // reopen, whatever the motion setting.
    await page.waitForTimeout(150);
    expect(await burstSeen(page)).toBe(false);
    await page.waitForTimeout(600);
    await expect(page.getByTestId("tick-burst")).toHaveCount(0);
  });
});
