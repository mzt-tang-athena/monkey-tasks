import { expect, test } from "../fixtures";

/**
 * Ticket 0061: the split lays out by fraction, so the first frame of a
 * day page is the one the layout settles on. The old split used a 320 px
 * default until the layout reported, and a 360 by 640 screen painted the
 * source toggle over the bottom bar once.
 */

test.describe("the split's first frame", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("the day list never paints over the bottom bar", async ({ page }) => {
    // Six times slower, and the suite may share the runner: the app
    // needs more than the default five seconds to paint.
    test.slow();
    await page.addInitScript(() => {
      const seen = window as unknown as {
        frames: { toggleBottom: number; barTop: number }[];
        stop: () => void;
      };
      seen.frames = [];
      let live = true;
      seen.stop = () => {
        live = false;
      };
      const sample = () => {
        const toggle = document.querySelector('[aria-label^="task source:"]');
        const bar = document.querySelector('[role="tab"][aria-label="Planner"]');
        if (toggle != null && bar != null) {
          seen.frames.push({
            toggleBottom: toggle.getBoundingClientRect().bottom,
            barTop: bar.getBoundingClientRect().top,
          });
        }
        if (live) {
          requestAnimationFrame(sample);
        }
      };
      requestAnimationFrame(sample);
    });

    // Six times slower, as the bug's repro recorded it.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible({ timeout: 20_000 });
    const toggle = page.getByRole("button", { name: /^task source:/ });
    await expect(toggle).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);

    const frames = await page.evaluate(() => {
      const seen = window as unknown as {
        frames: { toggleBottom: number; barTop: number }[];
        stop: () => void;
      };
      seen.stop();
      return seen.frames;
    });
    const settled = await toggle.boundingBox();
    const bar = await page.getByRole("tab", { name: "Planner" }).boundingBox();
    if (settled == null || bar == null) {
      throw new Error("the toggle or the bottom bar has no box");
    }

    expect(frames.length).toBeGreaterThan(2);
    for (const frame of frames) {
      expect(frame.toggleBottom).toBeLessThanOrEqual(frame.barTop);
    }
    // The first frame with a toggle is the settled one, not a px default
    // that lands later.
    expect(Math.abs(frames[0].toggleBottom - (settled.y + settled.height))).toBeLessThanOrEqual(4);
  });
});
