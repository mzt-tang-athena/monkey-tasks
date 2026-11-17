import type { Locator, Page } from "@playwright/test";
import { expect, pauseClock, test } from "../fixtures";
import { capture, undated } from "../data";
import type { Input } from "../gestures";
import { row } from "../locators";
import { notePaths } from "../vault";

/**
 * Ticket 0062: the capture sheet, its scrim, the dock and the bar move
 * on one `useProgress` clock. The browser has no soft keyboard, so the
 * keyboard path is an emulator and phone check; here the keyboard's
 * shared values stay 0.
 *
 * Every scenario runs with the mouse and with CDP touch, in both
 * projects. Each sample reads what the user sees on a frame: the sheet
 * and scrim opacities, the bar's translate as a share of its layout
 * height, the bar's layout box, and the row count.
 */

type Sample = {
  at: number;
  dialog: boolean;
  sheet: number;
  scrim: number;
  /** The bar's translate as a share of its layout height. */
  bar: number;
  /** The bar's layout height in px. A layout pass changes it. */
  barBox: number;
  rows: number;
};

type Recorder = {
  frames: Sample[];
  live: boolean;
  tapAt: number;
  rowName: string;
};

/** Record one sample per animation frame until `stopSampling`. */
async function startSampling(page: Page, rowName: string) {
  await page.evaluate((name) => {
    const record: Recorder = {
      frames: [],
      live: true,
      tapAt: 0,
      rowName: name,
    };
    const state = window as unknown as { __captureClock?: Recorder };
    state.__captureClock = record;
    const sample = () => {
      const dialog = document.querySelector('[role="dialog"]');
      const close = document.querySelector('[aria-label="close capture"]');
      const scrim = close == null ? null : close.parentElement;
      const bar = document.querySelector('[data-testid="bottom-bar"]');
      const box = bar instanceof HTMLElement ? bar.offsetHeight : 0;
      const matrix =
        bar == null
          ? null
          : new DOMMatrixReadOnly(getComputedStyle(bar).transform);
      record.frames.push({
        at: performance.now(),
        dialog: dialog != null,
        sheet: dialog == null ? -1 : Number(getComputedStyle(dialog).opacity),
        scrim: scrim == null ? -1 : Number(getComputedStyle(scrim).opacity),
        bar: matrix == null || box === 0 ? -1 : matrix.f / box,
        barBox: box,
        rows: document.querySelectorAll(
          `[data-testid="task-row:${record.rowName}"]`,
        ).length,
      });
      if (record.live) {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  }, rowName);
}

async function stopSampling(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const state = window as unknown as {
      __captureClock?: { frames: Sample[]; live: boolean };
    };
    const record = state.__captureClock;
    if (record == null) {
      return [];
    }
    record.live = false;
    return record.frames;
  });
}

/** The time the next click reaches the page, in `performance.now` ms. */
async function markTap(page: Page) {
  await page.evaluate(() => {
    document.addEventListener(
      "click",
      () => {
        const state = window as unknown as {
          __captureClock?: { tapAt: number };
        };
        if (state.__captureClock != null) {
          state.__captureClock.tapAt = performance.now();
        }
      },
      { capture: true, once: true },
    );
  });
}

async function tapAt(page: Page): Promise<number> {
  return page.evaluate(() => {
    const state = window as unknown as { __captureClock?: { tapAt: number } };
    return state.__captureClock?.tapAt ?? -1;
  });
}

/** Press `target` with the chosen input. A press has no drag. */
async function tap(page: Page, input: Input, target: Locator) {
  const box = await target.boundingBox();
  if (box == null) {
    throw new Error(`${target} has no box`);
  }
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (input === "mouse") {
    await page.mouse.click(point.x, point.y);
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await page.waitForTimeout(16);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}

/** True when no ancestor hides `target` from assistive tech. */
async function expectReachable(target: Locator) {
  await expect
    .poll(() =>
      target.evaluate(
        (element) => element.closest('[aria-hidden="true"]') == null,
      ),
    )
    .toBe(true);
}

/** True when the bar's travel and the sheet's share one value. */
function expectOneClock(frames: Sample[], reduced: boolean) {
  const seen = frames.filter((frame) => frame.dialog);
  expect(seen.length, "the sheet mounted").toBeGreaterThan(0);

  const moving = seen.filter((frame) => frame.sheet > 0.02 && frame.sheet < 0.98);
  if (reduced) {
    expect(moving.length, "no fade frame with reduce motion").toBe(0);
  } else {
    expect(moving.length, "the sample caught the motion").toBeGreaterThan(0);
  }
  for (const frame of moving) {
    expect(
      Math.abs(frame.sheet - frame.bar),
      `sheet ${frame.sheet} against bar ${frame.bar} at ${frame.at}`,
    ).toBeLessThanOrEqual(0.03);
    expect(
      Math.abs(frame.sheet - frame.scrim),
      `sheet ${frame.sheet} against scrim ${frame.scrim} at ${frame.at}`,
    ).toBeLessThanOrEqual(0.03);
  }
  const boxes = new Set(frames.map((frame) => frame.barBox));
  expect(boxes.size, "the bar keeps one layout box").toBe(1);
}

const inputs: Input[] = ["mouse", "touch"];

for (const input of inputs) {
  test.describe(`with the ${input}`, () => {
    test("the sheet, the scrim and the bar travel on one clock", async ({
      page,
      reducedMotion,
    }) => {
      await page.goto("/");
      await expect(row(page, undated.second)).toBeVisible();

      // Step the page clock, so a loaded runner cannot skip every
      // intermediate frame of the 220 ms entrance.
      await pauseClock(page);
      await startSampling(page, "not-a-row");
      await tap(page, input, page.getByRole("button", { name: "add task" }));
      await page.clock.runFor(500);
      await page.clock.resume();
      await expect(page.getByRole("dialog")).toBeVisible();

      const frames = await stopSampling(page);
      expectOneClock(frames, reducedMotion === "reduce");

      const seen = frames.filter((frame) => frame.dialog);
      expect(seen.at(-1)!.sheet, "the sheet lands open").toBeCloseTo(1, 1);
      expect(seen.at(-1)!.bar, "the bar lands hidden").toBeCloseTo(1, 1);
    });

    test("a send closes on the tap and lands the row once, behind the write", async ({
      page,
      reducedMotion,
    }) => {
      await page.goto("/");
      await expect(row(page, undated.second)).toBeVisible();
      await tap(page, input, page.getByRole("button", { name: "add task" }));
      await page.getByPlaceholder("Add a task").fill(capture.typed);

      // The note write takes longer than the sheet's exit. The sheet
      // must leave before the file lands (ADR 0021).
      await page.evaluate(() => globalThis.__vault?.setLatency(1500));
      // Step the exit on the page clock, so a loaded runner cannot skip
      // every frame between the sheet's open and closed states.
      await pauseClock(page);
      await startSampling(page, capture.name);
      await page.clock.runFor(16);
      await markTap(page);
      await tap(page, input, page.getByRole("button", { name: "send task" }));
      await page.clock.runFor(400);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(row(page, capture.name)).toBeVisible();
      expect(
        await notePaths(page, "Tasks/"),
        "the sheet leaves before the write lands",
      ).not.toContain(`Tasks/${capture.name}.md`);

      const frames = await stopSampling(page);
      await page.clock.resume();
      const pressedAt = await tapAt(page);
      expect(pressedAt, "the press was seen").toBeGreaterThan(0);

      const mounted = frames.filter((frame) => frame.dialog);
      const unmounted = frames.find(
        (frame, index) => index > 0 && !frame.dialog && frames[index - 1].dialog,
      );
      expect(unmounted, "the sheet leaves").toBeDefined();

      if (reducedMotion === "reduce") {
        for (const frame of mounted) {
          expect(
            frame.sheet <= 0.02 || frame.sheet >= 0.98,
            "no fade frame with reduce motion",
          ).toBe(true);
        }
      } else {
        const firstClose = frames.find(
          (frame) => frame.at >= pressedAt && frame.dialog && frame.sheet < 0.95,
        );
        expect(firstClose, "the sheet starts to close").toBeDefined();
        // The browser runs Reanimated on the main thread, so the first
        // painted frame can wait for the new row's commit. The close
        // still starts with the press, far inside this bound.
        expect(
          firstClose!.at - pressedAt,
          "the close starts with the press, not with the write",
        ).toBeLessThanOrEqual(500);
        expect(
          unmounted!.at - pressedAt,
          "the exit plays before the sheet leaves",
        ).toBeGreaterThanOrEqual(120);
        expect(
          mounted.at(-1)!.sheet,
          "the last mounted frame is nearly gone",
        ).toBeLessThan(0.3);

        const closing = frames.filter(
          (frame) => frame.at >= pressedAt && frame.dialog && frame.sheet < 0.98,
        );
        expect(closing.length).toBeGreaterThan(0);
        for (const frame of closing) {
          expect(
            Math.abs(frame.sheet - frame.bar),
            `sheet ${frame.sheet} against bar ${frame.bar} at ${frame.at}`,
          ).toBeLessThanOrEqual(0.03);
        }
        expect(new Set(closing.map((frame) => frame.barBox)).size).toBe(1);
      }

      const lands = frames.filter(
        (frame, index) =>
          index > 0 && frames[index - 1].rows === 0 && frame.rows === 1,
      );
      expect(lands.length, "the row lands once").toBe(1);
      expect(frames.at(-1)!.rows, "the row stays").toBe(1);

      await expect
        .poll(() => notePaths(page, "Tasks/"), { timeout: 5000 })
        .toContain(`Tasks/${capture.name}.md`);
    });

    test("a reopen during the exit keeps the sheet mounted and opens it", async ({
      page,
      reducedMotion,
    }) => {
      // With reduce motion the exit has no frames, so no window to
      // reopen inside. The clock's supersession is covered in jsdom.
      test.skip(
        reducedMotion === "reduce",
        "the exit has no frames to reopen in",
      );

      await page.goto("/");
      await expect(row(page, undated.second)).toBeVisible();
      await tap(page, input, page.getByRole("button", { name: "add task" }));
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.waitForTimeout(300);

      // Freeze the clock so the exit stops where the test steps it.
      await pauseClock(page);
      await startSampling(page, "not-a-row");
      await tap(
        page,
        input,
        page.getByRole("button", { name: "close capture" }),
      );
      await page.clock.runFor(80);

      const midway = await page
        .getByRole("dialog")
        .evaluate((element) => Number(getComputedStyle(element).opacity));
      expect(midway, "the exit is under way").toBeLessThan(0.95);
      expect(midway, "the sheet has not left").toBeGreaterThan(0.02);

      // The closing panel takes no press, so the bar below it does. The
      // bar is hidden from assistive tech, so the label finds it.
      const reopenedAt = await page.evaluate(() => performance.now());
      await tap(page, input, page.locator('[aria-label="add task"]'));
      await page.clock.runFor(400);

      await expect(page.getByRole("dialog")).toHaveCount(1);
      const opacity = await page
        .getByRole("dialog")
        .evaluate((element) => Number(getComputedStyle(element).opacity));
      expect(opacity, "the sheet is open again").toBeCloseTo(1, 1);

      const frames = await stopSampling(page);
      const after = frames.filter((frame) => frame.at >= reopenedAt);
      expect(after.length).toBeGreaterThan(2);
      expect(
        after.every((frame) => frame.dialog),
        "the sheet stayed mounted through the reversal",
      ).toBe(true);

      await page.clock.resume();
    });

    test("a close leaves the bar whole and the sheet closed on return", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(row(page, undated.second)).toBeVisible();
      await tap(page, input, page.getByRole("button", { name: "add task" }));
      await expect(page.getByRole("dialog")).toBeVisible();

      // The sheet is modal, so the screen behind it is inert and the
      // keyboard cannot reach the nav. Escape closes it first.
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("tab", { name: "Planner" }).click();
      await expect(page).toHaveURL(/\/planner$/);
      await expect(
        page.getByRole("button", { name: "close capture" }),
      ).toHaveCount(0);
      await expectReachable(page.getByTestId("day-heading"));
      await expect(page.getByRole("tab", { name: "Planner" })).toBeInViewport({
        ratio: 1,
      });

      await page.getByRole("tab", { name: "Lists" }).click();
      await expect(row(page, undated.second)).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expectReachable(row(page, undated.second));
      await expect(page.getByRole("tab", { name: "Lists" })).toBeInViewport({
        ratio: 1,
      });

      // A collapsed bar hides its row. The whole Add button shows.
      const add = page.getByRole("button", { name: "add task" });
      await expect(add).toBeInViewport({ ratio: 1 });
      const box = await add.boundingBox();
      const viewport = page.viewportSize()!;
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

      await tap(page, input, add);
      await expect(page.getByRole("dialog")).toHaveCount(1);
    });

    test("reduce motion lands the open and the close with no fade or scale", async ({
      page,
      reducedMotion,
    }) => {
      await page.goto("/");
      await expect(row(page, undated.second)).toBeVisible();

      // Step the 220 ms entrance on the page clock. A loaded runner
      // can otherwise sample past every fade frame.
      await pauseClock(page);
      await startSampling(page, "not-a-row");
      await tap(page, input, page.getByRole("button", { name: "add task" }));
      await page.clock.runFor(300);
      await page.clock.resume();
      await expect(page.getByRole("dialog")).toBeVisible();
      const opening = await stopSampling(page);

      const shown = opening.filter((frame) => frame.dialog);
      expect(shown.length).toBeGreaterThan(0);

      if (reducedMotion === "reduce") {
        for (const frame of shown) {
          expect(
            frame.sheet <= 0.02 || frame.sheet >= 0.98,
            "no fade frame",
          ).toBe(true);
        }
        expect(
          shown.some((frame) => frame.sheet >= 0.98),
          "the sheet lands open",
        ).toBe(true);
        const state = await page.getByRole("dialog").evaluate((element) => {
          const matrix = new DOMMatrixReadOnly(
            getComputedStyle(element).transform,
          );
          return {
            opacity: Number(getComputedStyle(element).opacity),
            scale: matrix.a,
            offset: matrix.f,
          };
        });
        expect(state.opacity).toBeGreaterThanOrEqual(0.99);
        expect(Math.abs(state.scale - 1)).toBeLessThanOrEqual(0.001);
        expect(Math.abs(state.offset)).toBeLessThanOrEqual(0.5);
      } else {
        expect(
          shown.some((frame) => frame.sheet > 0.02 && frame.sheet < 0.98),
          "the sampler sees the fade",
        ).toBe(true);
      }

      await pauseClock(page);
      await startSampling(page, "not-a-row");
      await tap(
        page,
        input,
        page.getByRole("button", { name: "close capture" }),
      );
      await page.clock.runFor(300);
      await page.clock.resume();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const closing = await stopSampling(page);

      if (reducedMotion === "reduce") {
        for (const frame of closing.filter((frame) => frame.dialog)) {
          expect(frame.sheet, "no fade frame").toBeGreaterThanOrEqual(0.98);
        }
        for (const frame of closing) {
          expect(
            frame.bar <= 0.01 || frame.bar >= 0.99 || frame.bar === -1,
            `the bar returns at once: ${frame.bar} at ${frame.at}`,
          ).toBe(true);
        }
        expect(closing.at(-1)!.dialog, "the sheet is gone").toBe(false);
      } else {
        expect(
          closing.some(
            (frame) => frame.dialog && frame.sheet > 0.02 && frame.sheet < 0.98,
          ),
          "the sampler sees the fade",
        ).toBe(true);
      }
    });
  });
}
