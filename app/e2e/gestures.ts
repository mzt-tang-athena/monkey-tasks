import type { Locator, Page } from "@playwright/test";

/**
 * The pointer gestures the specs send. Every pixel value in the suite
 * lives in this file. `page.mouse` takes viewport points, so each
 * gesture scrolls its start into view first: a press below the fold
 * lands off screen and does nothing.
 */

/** Which way the finger travels. A swipe left turns to the next page. */
export type Direction = "left" | "right";

/**
 * How far a swipe travels. `page` is well past the 80 px commit
 * threshold (`swipeThreshold` in `src/lib/swipe.ts`). `short` reads as
 * a swipe but stays under it, so the page springs back.
 */
export type Travel = "page" | "short";

const travelPx: Record<Travel, number> = { page: 300, short: 50 };

/** A swipe starts this far in from the edge it travels away from. */
const startInset = { left: 52, right: 60 };

/** The steps of a swipe move, as the probe for ticket 0049 sent. */
const swipeSteps = 15;

/** The box of an element that is in view. */
async function boxOf(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box == null) {
    throw new Error(`${target} has no box`);
  }
  return box;
}

/** Where a swipe on `from` starts and how far it moves, in viewport
    points. It starts at the vertical middle of `from`. */
async function swipePath(page: Page, from: Locator, dir: Direction, travel: Travel) {
  const box = await boxOf(from);
  const width = page.viewportSize()?.width ?? box.x + box.width;
  const x = dir === "left" ? width - startInset.left : startInset.right;
  const dx = dir === "left" ? -travelPx[travel] : travelPx[travel];
  return { x, y: box.y + box.height / 2, dx };
}

/**
 * A horizontal mouse swipe that starts on `from`. Until 0059, start on
 * a section header, not a row: a swipe that starts on a row also opens
 * it (B1).
 */
export async function swipe(
  page: Page,
  from: Locator,
  dir: Direction,
  travel: Travel = "page",
) {
  const { x, y, dx } = await swipePath(page, from, dir, travel);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + 2, { steps: swipeSteps });
  await page.mouse.up();
}

/** Where on the target a drag lets go. */
export type DropAt = "center" | "upper";

/**
 * Press `from`, hold past the pick delay (`drag.pickMs`, 300 ms, in
 * `src/theme/tokens.ts`), then move onto `to` and let go. `upper`
 * drops a quarter of the way down the target, so a row lands above
 * it. A `holdMs` of 0 suits a grip, which lifts at once.
 */
export async function holdDrag(
  page: Page,
  from: Locator,
  to: Locator,
  { at = "center", holdMs = 400 }: { at?: DropAt; holdMs?: number } = {},
) {
  const target = await boxOf(to);
  const start = await boxOf(from);
  const toX = target.x + target.width / 2;
  const toY = target.y + target.height * (at === "upper" ? 0.25 : 0.5);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.up();
}

/**
 * A touch swipe through CDP that starts on `from`. It needs a context
 * with `hasTouch`.
 */
export async function touchSwipe(
  page: Page,
  from: Locator,
  dir: Direction,
  travel: Travel = "page",
) {
  const { x, y, dx } = await swipePath(page, from, dir, travel);
  const cdp = await page.context().newCDPSession(page);
  const send = (
    type: "touchStart" | "touchMove" | "touchEnd",
    at?: { x: number; y: number },
  ) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: at == null ? [] : [at],
    });
  await send("touchStart", { x, y });
  for (let i = 1; i <= swipeSteps; i++) {
    await send("touchMove", { x: x + (dx * i) / swipeSteps, y });
    // One frame between moves, as a finger sends them.
    await page.waitForTimeout(16);
  }
  await send("touchEnd");
  await cdp.detach();
}
