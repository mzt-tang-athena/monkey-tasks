import { expect, type Locator, type Page } from "@playwright/test";
import { pauseClock } from "./fixtures";

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
 * threshold (`motion.swipe` in `src/lib/motion/tokens.ts`). `short`
 * reads as a swipe but stays under it, so the page springs back.
 */
export type Travel = "page" | "short";

const travelPx: Record<Travel, number> = { page: 300, short: 50 };

/** The drag distances the pager scenarios send, in px. */
export const dragPx = {
  /** A drag that follows the finger but stays under the commit. */
  short: 40,
  /** A drag past the commit threshold, and past the flick speed. */
  flick: 120,
  /** A long drag that commits on distance, not speed. */
  turn: 300,
  /** A drag against a closed end, where the rubber band caps. */
  rubber: 200,
  /** A vertical drag, and the sideways drift a thumb adds. */
  driftY: 300,
  driftX: 30,
} as const;

/** The share of the pager width a held drag travels. */
export const holdShare = 0.95;

/** A swipe starts this far in from the edge it travels away from. */
const startInset = { left: 52, right: 60 };

/** The steps of a swipe move, as the probe for ticket 0049 sent. */
const swipeSteps = 15;

/** A drag that keeps the button down ends here, short of the edge. */
const holdInset = 16;

/** The box of an element that is in view. */
async function boxOf(target: Locator) {
  // A render can replace the node while the scroll waits for it to hold
  // still, and the scroll then fails with "not attached" at once. The
  // block looks the node up again until it holds a box.
  let box: { x: number; y: number; width: number; height: number } | null = null;
  await expect(async () => {
    await target.scrollIntoViewIfNeeded();
    box = await target.boundingBox();
    expect(box, `${target} has no box`).not.toBeNull();
  }).toPass({ timeout: 10_000 });
  return box as unknown as { x: number; y: number; width: number; height: number };
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
 * A horizontal mouse swipe that starts on `from`. The press guard
 * keeps a swipe that starts on a row from opening it (ticket 0055).
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
 * Press `from` and hold. Gesture handler's web long press is a
 * `setTimeout`, so the hold pauses the page clock and steps it past
 * `holdMs`: real time would race a busy runner, and a paused clock
 * would stall the press. The clock runs again before the move, so the
 * drag and the rest of a spec run on real time.
 */
async function pressAndHold(page: Page, from: Locator, holdMs: number) {
  const start = await boxOf(from);
  await pauseClock(page);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.clock.runFor(holdMs + 50);
  await page.clock.resume();
}

/**
 * Press `from`, hold past the row hold (`motion.hold.row`, 300 ms, in
 * `src/lib/motion/tokens.ts`), then move onto `to` and let go. `upper`
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
  const toX = target.x + target.width / 2;
  const toY = target.y + target.height * (at === "upper" ? 0.25 : 0.5);
  await pressAndHold(page, from, holdMs);
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.up();
}

/**
 * Press `from`, hold past the pick delay, then move to a page point and
 * stay there with the button down. The caller ends the gesture with
 * `page.mouse.up()`. A test that reads the drag ghost needs this.
 */
export async function holdDragTo(
  page: Page,
  from: Locator,
  point: { x: number; y: number },
  { holdMs = 400 }: { holdMs?: number } = {},
) {
  await pressAndHold(page, from, holdMs);
  await page.mouse.move(point.x, point.y, { steps: 12 });
}

export type Input = "mouse" | "touch";

export type Point = { x: number; y: number };

/** A drag held open by the caller. */
export type Pointer = {
  moveTo: (point: Point) => Promise<void>;
  up: () => Promise<void>;
};

/** A touch drag, which can also end in a cancel. */
export type TouchPointer = Pointer & { cancel: () => Promise<void> };

/** A point on `target`, as `page.mouse` addresses it. */
export async function pointOn(
  page: Page,
  target: Locator,
  at: DropAt = "center",
): Promise<Point> {
  const box = await boxOf(target);
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height * (at === "upper" ? 0.25 : 0.5),
  };
}

/** Steps a touch sends between two points. */
const touchSteps = 12;

/**
 * Press `from` and hold past its delay, with the chosen input. The
 * gesture stays open until the caller ends it. A paused page clock
 * steps past the hold, so a busy runner cannot race it.
 *
 * `paused` leaves the page clock stopped after the press. A test that
 * releases before the hold completes keeps it stopped through the
 * release, so no timer can complete the long press in between.
 */
export async function press(
  page: Page,
  input: Input,
  from: Locator,
  { holdMs = 400, paused = false }: { holdMs?: number; paused?: boolean } = {},
): Promise<Pointer | TouchPointer> {
  const start = await boxOf(from);
  await pauseClock(page);

  if (input === "mouse") {
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.clock.runFor(holdMs + 50);
    if (!paused) {
      await page.clock.resume();
    }
    return {
      async moveTo(point) {
        await page.mouse.move(point.x, point.y, { steps: touchSteps });
      },
      async up() {
        await page.mouse.up();
      },
    };
  }

  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel", at?: Point) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: at == null ? [] : [at],
    });
  const at = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  await send("touchStart", at);
  await page.clock.runFor(holdMs + 50);
  if (!paused) {
    await page.clock.resume();
  }
  return {
    async moveTo(point) {
      for (let i = 1; i <= touchSteps; i++) {
        await send("touchMove", {
          x: at.x + ((point.x - at.x) * i) / touchSteps,
          y: at.y + ((point.y - at.y) * i) / touchSteps,
        });
        // One frame between moves, as a finger sends them.
        await page.waitForTimeout(16);
      }
    },
    async up() {
      await send("touchEnd");
      await cdp.detach();
    },
    async cancel() {
      await send("touchCancel");
      await cdp.detach();
    },
  };
}

export async function dragWith(
  page: Page,
  input: Input,
  from: Locator,
  to: Locator,
  { at = "center", holdMs = 400 }: { at?: DropAt; holdMs?: number } = {},
) {
  // The target's point comes first: scrolling it into view after the
  // press would move the source under the finger.
  const end = await pointOn(page, to, at);
  const pointer = await press(page, input, from, { holdMs });
  await pointer.moveTo(end);
  await pointer.up();
}

/** Ends a touch drag as a cancel. A mouse drag has no cancel. */
export async function cancelTouch(pointer: Pointer | TouchPointer) {
  if (!("cancel" in pointer)) {
    throw new Error("a mouse drag has no cancel");
  }
  await pointer.cancel();
}

/**
 * A CDP touch from `from` that travels `dy` px with no hold, as a
 * finger that scrolls before any hold can complete.
 */
export async function touchFlick(
  page: Page,
  from: Locator,
  dy: number,
  { steps = 10, waitMs = 16 }: { steps?: number; waitMs?: number } = {},
) {
  const box = await boxOf(from);
  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", at?: Point) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: at == null ? [] : [at],
    });
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await send("touchStart", { x, y });
  for (let i = 1; i <= steps; i++) {
    await send("touchMove", { x, y: y + (dy * i) / steps });
    await page.waitForTimeout(waitMs);
  }
  await send("touchEnd");
  await cdp.detach();
}

/** How far a scrollable ancestor of `target` has scrolled down. */
export async function scrollTopOf(target: Locator): Promise<number> {
  return target.evaluate((element) => {
    let node: HTMLElement | null = element as HTMLElement;
    while (node != null) {
      if (node.scrollHeight > node.clientHeight + 1) {
        return node.scrollTop;
      }
      node = node.parentElement;
    }
    return 0;
  });
}

/**
 * The `touch-action` the browser computes on `target`. A surface sets
 * it in its gesture config: `pan-y` on a pager and on a row or pill
 * source, `none` on a grip (ADR 0046).
 */
export async function expectTouchAction(target: Locator, value: "pan-y" | "none") {
  await expect
    .poll(() => target.evaluate((element) => getComputedStyle(element).touchAction))
    .toBe(value);
}

/** Where a drag starts on the target: its vertical middle, and one of
    the horizontal anchors. */
async function dragStart(
  target: Locator,
  side: "left" | "center" | "right",
): Promise<{ x: number; y: number }> {
  const box = await boxOf(target);
  const x =
    side === "left"
      ? box.x + holdInset
      : side === "right"
        ? box.x + box.width - holdInset
        : box.x + box.width / 2;
  return { x, y: box.y + box.height / 2 };
}

/**
 * A CDP touch from one point to another. `end` is the CDP event that
 * finishes it: a release, or a cancel the browser sends when a system
 * gesture takes over. It needs a context with `hasTouch`.
 */
async function touchPath(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  end: "touchEnd" | "touchCancel",
  steps = swipeSteps,
) {
  const cdp = await page.context().newCDPSession(page);
  const send = (
    type: "touchStart" | "touchMove" | typeof end,
    at?: { x: number; y: number },
  ) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: at == null ? [] : [at],
    });
  await send("touchStart", from);
  for (let i = 1; i <= steps; i++) {
    await send("touchMove", {
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
    });
    // One frame between moves, as a finger sends them.
    await page.waitForTimeout(16);
  }
  await send(end);
  await cdp.detach();
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
  await touchPath(page, { x, y }, { x: x + dx, y }, "touchEnd");
}

/**
 * The same travel as `touchSwipe`, ended by the browser's
 * `touchCancel`. A cancelled touch is no release, so it never turns a
 * page (V12).
 */
export async function touchCancel(
  page: Page,
  from: Locator,
  dir: Direction,
  travel: Travel = "page",
) {
  const { x, y, dx } = await swipePath(page, from, dir, travel);
  await touchPath(page, { x, y }, { x: x + dx, y }, "touchCancel");
}

/**
 * A mouse drag of `dx` px that starts on `target`. It leaves the
 * button down, so the caller can read the mid-drag frame, take a
 * screenshot, or end the gesture over another element. Returns where
 * the pointer now stands.
 */
export async function dragHold(
  page: Page,
  target: Locator,
  dx: number,
  { side = "center", steps = swipeSteps }: { side?: "left" | "center" | "right"; steps?: number } = {},
) {
  const start = await dragStart(target, side);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + 2, { steps });
  return { start, at: { x: start.x + dx, y: start.y + 2 } };
}

/** A mouse drag of `dx` px on `target`, released at the same y. */
export async function mouseDrag(
  page: Page,
  target: Locator,
  dx: number,
  options: { side?: "left" | "center" | "right"; steps?: number } = {},
) {
  await dragHold(page, target, dx, options);
  await page.mouse.up();
}

/**
 * A CDP touch drag of `dx` px on `target`, with an optional drift.
 * `end` says whether the browser releases it or cancels it.
 */
export async function touchDrag(
  page: Page,
  target: Locator,
  dx: number,
  {
    dy = 0,
    side = "center",
    end = "touchEnd",
    steps = swipeSteps,
  }: {
    dy?: number;
    side?: "left" | "center" | "right";
    end?: "touchEnd" | "touchCancel";
    steps?: number;
  } = {},
) {
  const start = await dragStart(target, side);
  await touchPath(
    page,
    start,
    { x: start.x + dx, y: start.y + dy },
    end,
    steps,
  );
}

/**
 * A vertical CDP touch drag with a little sideways drift. It reads as
 * a scroll, so the list scrolls and no page turns (B2).
 */
export async function touchDrift(
  page: Page,
  target: Locator,
  dy: number,
  dx: number,
) {
  const start = await dragStart(target, "center");
  await touchPath(
    page,
    start,
    { x: start.x + dx, y: start.y + dy },
    "touchEnd",
  );
}

/**
 * A mouse drag held at its end, so `during` can read or capture the
 * mid-gesture frame. It releases after the callback returns.
 */
export async function mouseHold(
  page: Page,
  target: Locator,
  dx: number,
  during: () => Promise<void>,
  { side = "center", steps = swipeSteps }: { side?: "left" | "center" | "right"; steps?: number } = {},
) {
  await dragHold(page, target, dx, { side, steps });
  await during();
  await page.mouse.up();
}

/**
 * A CDP touch drag held at its end, so `during` can read or capture
 * the mid-gesture frame. It releases after the callback returns.
 */
export async function touchHold(
  page: Page,
  target: Locator,
  dx: number,
  during: () => Promise<void>,
  {
    dy = 0,
    side = "center",
    steps = swipeSteps,
  }: { dy?: number; side?: "left" | "center" | "right"; steps?: number } = {},
) {
  const start = await dragStart(target, side);
  const cdp = await page.context().newCDPSession(page);
  const send = (
    type: "touchStart" | "touchMove" | "touchEnd",
    at?: { x: number; y: number },
  ) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: at == null ? [] : [at],
    });
  await send("touchStart", start);
  for (let i = 1; i <= steps; i++) {
    await send("touchMove", {
      x: start.x + (dx * i) / steps,
      y: start.y + (dy * i) / steps,
    });
    await page.waitForTimeout(16);
  }
  await during();
  await send("touchEnd");
  await cdp.detach();
}
