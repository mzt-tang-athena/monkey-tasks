import { writeFileSync } from "node:fs";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect, pauseClock, test } from "../fixtures";
import {
  months,
  sections,
  supplements,
  tabs,
  tomorrow,
  undated,
} from "../data";
import {
  dragHold,
  dragPx,
  expectTouchAction,
  holdShare,
  mouseDrag,
  mouseHold,
  touchCancel,
  touchDrag,
  touchDrift,
  touchHold,
  touchSwipe,
  swipe,
} from "../gestures";
import { listTab, press, row, sectionHeader } from "../locators";
import { putNote, returnToTab } from "../vault";

/**
 * Ticket 0059: the list tabs, the planner day body and the month
 * calendar page on the shared `Pager` surface. Each scenario runs with
 * the mouse and with CDP touch, and the whole suite runs again with
 * reduce motion.
 */

test.use({ viewport: { width: 400, height: 900 } });

/** The tab two places after Main, behind Errands. */
const finance = "Finance";
/** The tab three places after Main. It holds sample tasks. */
const focus = "Focus";

/** The horizontal position of the pager's track, in px. */
async function trackX(page: Page): Promise<number> {
  return page.getByTestId("pager-track").evaluate((element) => {
    const value = getComputedStyle(element).transform;
    if (value === "none" || value === "") {
      return 0;
    }
    const matrix = /^matrix\((.+)\)$/.exec(value);
    if (matrix != null) {
      return Number(matrix[1].split(",")[4]);
    }
    const translate = /translateX\((-?[\d.]+)px\)/.exec(value);
    return translate == null ? Number.NaN : Number(translate[1]);
  });
}

/**
 * The live page's offset from its pager's box, in px. The track moves
 * through page space now, so it stands at `-page * width` at rest. The
 * live page carries its own share of that offset, and the sum is 0.
 */
async function liveOffset(
  page: Page,
  testID: string,
): Promise<{ x: number; y: number }> {
  const host = await page.getByTestId(testID).boundingBox();
  const live = await page.getByTestId("pager-live").boundingBox();
  if (host == null || live == null) {
    throw new Error("the pager or its live page has no box");
  }
  return { x: Math.round(live.x - host.x), y: Math.round(live.y - host.y) };
}

/** The deepest scrolled element on the page. */
function scrollTop(page: Page): Promise<number> {
  return page.evaluate(() =>
    Math.max(
      0,
      ...[...document.querySelectorAll("div")].map((element) => element.scrollTop),
    ),
  );
}

/** The pager's box, which the screenshot pair reads. */
async function pagerBox(page: Page, testID: string) {
  const box = await page.getByTestId(testID).boundingBox();
  if (box == null) {
    throw new Error(`${testID} has no box`);
  }
  return box;
}

/**
 * One half of a screenshot pair: the same share of the page, taken
 * from where the preview stands during the hold and from where the
 * live page stands after it lands.
 */
function pageClip(
  box: { x: number; y: number; width: number; height: number },
  previewX: number,
  viewportHeight: number,
  side: "preview" | "live",
  direction: "left" | "right",
): { x: number; y: number; width: number; height: number } {
  // The preview page stands `shift` px beside the live one. Both
  // clips cover the same columns of the page.
  const shift = Math.round(Math.abs(previewX - box.x));
  const width = Math.round(box.width) - shift;
  const offset =
    direction === "left"
      ? side === "preview"
        ? shift
        : 0
      : side === "preview"
        ? 0
        : shift;
  return {
    x: Math.round(box.x) + offset,
    y: Math.round(box.y),
    width,
    height: Math.min(Math.round(box.height), viewportHeight - Math.round(box.y)),
  };
}

/** The share of pixels that differ, with edge antialiasing ignored. */
function pixelDiff(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ({ one, two }) => {
      const load = (data: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("the image did not load"));
          image.src = `data:image/png;base64,${data}`;
        });
      const [first, second] = await Promise.all([load(one), load(two)]);
      if (first.width !== second.width || first.height !== second.height) {
        return 1;
      }
      const canvas = document.createElement("canvas");
      canvas.width = first.width;
      canvas.height = first.height;
      const context = canvas.getContext("2d");
      if (context == null) {
        return 1;
      }
      context.drawImage(first, 0, 0);
      const a = context.getImageData(0, 0, first.width, first.height).data;
      context.clearRect(0, 0, first.width, first.height);
      context.drawImage(second, 0, 0);
      const b = context.getImageData(0, 0, first.width, first.height).data;
      let different = 0;
      for (let i = 0; i < a.length; i += 4) {
        const delta =
          Math.abs(a[i] - b[i]) +
          Math.abs(a[i + 1] - b[i + 1]) +
          Math.abs(a[i + 2] - b[i + 2]);
        if (delta > 120) {
          different += 1;
        }
      }
      return different / (first.width * first.height);
    },
    { one: a.toString("base64"), two: b.toString("base64") },
  );
}

/** The deepest scroll offset inside a pager. A landed page starts at 0. */
function pagerScrollTop(page: Page, testID: string): Promise<number> {
  return page.evaluate((id) => {
    const root = document.querySelector(`[data-testid="${id}"]`);
    if (root == null) {
      return -1;
    }
    let deepest = 0;
    for (const element of root.querySelectorAll("div")) {
      deepest = Math.max(deepest, element.scrollTop);
    }
    return deepest;
  }, testID);
}

/** Attach both halves of a pair and assert they match. */
async function expectSamePicture(
  page: Page,
  testInfo: TestInfo,
  box: { x: number; y: number; width: number; height: number },
  previewX: number,
  direction: "left" | "right",
  preview: Buffer,
) {
  const viewport = page.viewportSize();
  if (viewport == null) {
    throw new Error("the page has no viewport");
  }
  const live = await page.screenshot({
    clip: pageClip(box, previewX, viewport.height, "live", direction),
  });
  await testInfo.attach(`preview-${direction}`, {
    body: preview,
    contentType: "image/png",
  });
  await testInfo.attach(`live-${direction}`, {
    body: live,
    contentType: "image/png",
  });
  if (live.equals(preview)) {
    return;
  }
  writeFileSync(testInfo.outputPath(`preview-${direction}.png`), preview);
  writeFileSync(testInfo.outputPath(`live-${direction}.png`), live);
  writeFileSync(
    testInfo.outputPath(`clip-${direction}.json`),
    JSON.stringify({
      live: pageClip(box, previewX, viewport.height, "live", direction),
      preview: pageClip(box, previewX, viewport.height, "preview", direction),
    }),
  );
  // The held page stands a fraction of a pixel beside the landed one,
  // so text edges antialias a little differently. The same content
  // differs in about 1 percent of pixels; a one-pixel shift differs in
  // more than 3.
  const different = await pixelDiff(page, preview, live);
  expect(different, "the preview and the landed page match").toBeLessThan(0.025);
}

/** A note on another tab, so its preview has content to compare. */
async function seedErrand(page: Page) {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await putNote(
    page,
    "Tasks/Preview errand.md",
    '---\nkind: "[[tasks]]"\ncreated: 2026-10-01T09:00\nlists:\n  - "[[Errands]]"\n---\n',
  );
  await returnToTab(page);
}

/** A note on Finance, the page after the one a single flick lands on. */
async function seedFinance(page: Page) {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await putNote(
    page,
    "Tasks/Finance page two.md",
    '---\nkind: "[[tasks]]"\ncreated: 2026-10-01T09:00\nlists:\n  - "[[Finance]]"\n---\n',
  );
  await returnToTab(page);
  await listTab(page, finance).click();
  await expect(row(page, "Finance page two")).toBeVisible();
  await listTab(page, tabs.main).click();
  await expect(row(page, undated.second)).toBeVisible();
}

/** Pause the clock, let one frame paint, and read what stands. */
async function frame(page: Page, ms = 32) {
  await page.clock.runFor(ms);
}

function isMotion(testInfo: TestInfo): boolean {
  return testInfo.project.name !== "reduced-motion";
}

/** The scenarios every input path runs. */
function commonScenarios(input: "mouse" | "touch") {
  const drag = async (page: Page, dx: number, steps?: number) => {
    const target = page.getByTestId("list-pager");
    if (input === "touch") {
      await touchDrag(page, target, dx, { steps });
    } else {
      await mouseDrag(page, target, dx, { steps });
    }
  };
  const turn = async (page: Page, target: Parameters<typeof swipe>[1]) => {
    if (input === "touch") {
      await touchSwipe(page, target, "left");
    } else {
      await swipe(page, target, "left");
    }
  };

  test("a swipe turns the list page", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await turn(page, sectionHeader(page, sections.today));

    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "false");
  });

  test("a swipe that starts on a row opens no editor", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await turn(page, row(page, supplements));

    await expect(
      listTab(page, tabs.next),
      "the swipe turns the page, and the row's editor stays closed",
    ).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL("/");
  });

  test("a short drag keeps its preview until the track rests", async ({ page }, testInfo) => {
    test.skip(!isMotion(testInfo), "reduce motion never mounts a preview");
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await pauseClock(page);
    if (input === "touch") {
      await touchHold(page, sectionHeader(page, sections.today), -dragPx.short, async () => {
        await frame(page);
        await expect(page.getByTestId("preview:1")).toBeVisible();
      });
    } else {
      await mouseHold(page, sectionHeader(page, sections.today), -dragPx.short, async () => {
        await frame(page);
        await expect(page.getByTestId("preview:1")).toBeVisible();
      });
    }
    await frame(page, 500);
    await expect(page.getByTestId("preview:1")).toHaveCount(0);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
    await page.clock.resume();
  });

  test("two fast drags move two tabs", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await drag(page, -dragPx.flick, 4);
    await page.waitForTimeout(100);
    await drag(page, -dragPx.flick, 4);

    await expect(listTab(page, finance)).toHaveAttribute("aria-selected", "true");
  });

  test("a landed tab holds no page two away", async ({ page }, testInfo) => {
    test.skip(!isMotion(testInfo), "reduce motion never mounts a preview");
    await seedFinance(page);

    await pauseClock(page);
    if (input === "touch") {
      await touchHold(page, sectionHeader(page, sections.today), -dragPx.turn, async () => {
        await frame(page);
        await expect(page.getByTestId("preview:1")).toBeVisible();
        await expect(page.getByTestId("preview:2")).toHaveCount(0);
      });
    } else {
      await mouseHold(page, sectionHeader(page, sections.today), -dragPx.turn, async () => {
        await frame(page);
        await expect(page.getByTestId("preview:1")).toBeVisible();
        await expect(page.getByTestId("preview:2")).toHaveCount(0);
      });
    }
    await frame(page, 600);
    await expect(page.getByTestId("preview:2")).toHaveCount(0);
    await expect(page.getByText("Finance page two")).toHaveCount(0);
    await page.clock.resume();
  });

  test("a drag right at the first list stops at the rubber band", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await pauseClock(page);
    if (input === "touch") {
      await touchHold(page, sectionHeader(page, sections.today), dragPx.rubber, async () => {
        await frame(page);
        const x = await trackX(page);
        expect(Math.abs(x)).toBeLessThanOrEqual(48);
        expect(Math.abs(x)).toBe(isMotion(testInfo) ? 48 : 0);
      });
    } else {
      await mouseHold(page, sectionHeader(page, sections.today), dragPx.rubber, async () => {
        await frame(page);
        const x = await trackX(page);
        expect(Math.abs(x)).toBeLessThanOrEqual(48);
        expect(Math.abs(x)).toBe(isMotion(testInfo) ? 48 : 0);
      });
    }
    await frame(page, 500);
    await expect.poll(() => trackX(page)).toBe(0);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
    await page.clock.resume();
  });

  test("a tab tap one page away slides", async ({ page }, testInfo) => {
    test.skip(!isMotion(testInfo), "reduce motion jumps to the page");
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    const width = (await pagerBox(page, "list-pager")).width;

    await pauseClock(page);
    if (input === "touch") {
      await listTab(page, tabs.next).tap();
    } else {
      await listTab(page, tabs.next).click();
    }
    await frame(page, 60);

    const x = await trackX(page);
    expect(x, "the track is between the pages").toBeLessThan(-1);
    expect(x).toBeGreaterThan(-width + 1);
    await page.clock.runFor(500);
    // The track rests in page space; the live page sits at the host's
    // origin, where its preview drew it.
    await expect.poll(async () => (await liveOffset(page, "list-pager")).x).toBe(0);
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await page.clock.resume();
  });

  test("a tab tap three pages away cuts", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await pauseClock(page);
    if (input === "touch") {
      await listTab(page, focus).tap();
    } else {
      await listTab(page, focus).click();
    }
    await frame(page);

    await expect.poll(async () => (await liveOffset(page, "list-pager")).x).toBe(0);
    await expect(page.getByTestId("preview:1")).toHaveCount(0);
    await expect(page.getByTestId("preview:2")).toHaveCount(0);
    await expect(listTab(page, focus)).toHaveAttribute("aria-selected", "true");
    await page.clock.resume();
  });

  test("a swipe on a month cell opens no day", async ({ page }) => {
    await page.goto("/planner");
    await page.getByRole("tab", { name: "Month", exact: true }).click();
    await expect(page.getByTestId("month-title")).toHaveText(months.current);

    const cell = page.getByRole("gridcell", { name: "Wednesday 28" });
    await turn(page, cell);

    await expect(page.getByTestId("month-title")).toHaveText(months.next);
    await expect(page.getByRole("button", { name: "open this day" })).toHaveCount(0);
  });
}

/** A hold that keeps the page in its mid-swipe frame. */
type Hold = (
  target: Locator,
  dx: number,
  side: "left" | "right",
  during: () => Promise<void>,
) => Promise<void>;

/**
 * The two screenshot pairs the day owes: a swipe onto a day with a
 * recurring task, and a swipe back onto today. The timeline is
 * scrolled to its middle first, so a kept live cell would land there.
 * The preview and the landed page must draw at the same scroll, from
 * the same rows and the same `now`.
 */
async function dayScreenshots(page: Page, testInfo: TestInfo, hold: Hold) {
  await page.goto("/planner");
  await expect(page.getByTestId("day-heading")).toBeVisible();
  const pager = await pagerBox(page, "day-pager");
  const viewport = page.viewportSize();
  if (viewport == null) {
    throw new Error("the page has no viewport");
  }

  await page.mouse.move(pager.x + pager.width / 2, pager.y + 120);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);
  const kept = await pagerScrollTop(page, "day-pager");
  await pauseClock(page);
  let preview: Buffer | null = null;
  let previewX = Number.NaN;
  await hold(
    page.getByTestId("day-pager"),
    -Math.round(pager.width * holdShare),
    "right",
    async () => {
      await frame(page);
      const cell = page.getByTestId("preview:1");
      await expect(cell).toBeVisible();
      const box = await cell.boundingBox();
      if (box == null) {
        throw new Error("the preview has no box");
      }
      previewX = box.x;
      preview = await page.screenshot({
        clip: pageClip(pager, previewX, viewport.height, "preview", "left"),
      });
    },
  );
  await frame(page, 600);
  await page.clock.resume();
  await expect(page.getByTestId("day-heading")).toContainText(tomorrow.heading);
  await expect(row(page, tomorrow.task)).toBeVisible();
  await page.waitForTimeout(500);
  // The landed day keeps the live scroll, as its preview drew it. The
  // browser's scroll anchor may move it by the height of a row whose
  // content changed; it never returns to the top.
  const landed = await pagerScrollTop(page, "day-pager");
  expect(landed, "the day keeps its scroll").toBeGreaterThan(0);
  expect(Math.abs(landed - kept), "the anchor moves it less than a row").toBeLessThanOrEqual(32);
  await expectSamePicture(
    page,
    testInfo,
    pager,
    previewX,
    "left",
    preview as unknown as Buffer,
  );

  // Swipe back onto today: the preview draws the overdue block and the
  // now line from the same `now` as the live day. This scroll stays
  // under both days' content, so the offset survives the round trip.
  await page.mouse.move(pager.x + pager.width / 2, pager.y + 120);
  await page.mouse.wheel(0, 80);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);
  const keptBack = await pagerScrollTop(page, "day-pager");
  await pauseClock(page);
  let back: Buffer | null = null;
  let backX = Number.NaN;
  await hold(
    page.getByTestId("day-pager"),
    Math.round(pager.width * holdShare),
    "left",
    async () => {
      await frame(page);
      const cell = page.getByTestId("preview:0");
      await expect(cell).toBeVisible();
      const box = await cell.boundingBox();
      if (box == null) {
        throw new Error("the preview has no box");
      }
      backX = box.x;
      back = await page.screenshot({
        clip: pageClip(pager, backX, viewport.height, "preview", "right"),
      });
    },
  );
  await frame(page, 600);
  await page.clock.resume();
  await expect(page.getByTestId("day-heading")).toContainText("Monday 26");
  await expect(row(page, supplements)).toBeVisible();
  await page.waitForTimeout(500);
  const backKept = await pagerScrollTop(page, "day-pager");
  expect(backKept, "the day keeps its scroll").toBeGreaterThan(0);
  expect(
    Math.abs(backKept - keptBack),
    "the anchor moves it less than a row",
  ).toBeLessThanOrEqual(32);
  await expectSamePicture(
    page,
    testInfo,
    pager,
    backX,
    "right",
    back as unknown as Buffer,
  );
}

test.describe("with the mouse", () => {
  test("the three pager hosts take a vertical pan", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await expectTouchAction(page.getByTestId("list-pager"), "pan-y");

    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    await expectTouchAction(page.getByTestId("day-pager"), "pan-y");

    await page.getByRole("tab", { name: "Month", exact: true }).click();
    await expect(page.getByTestId("month-title")).toHaveText(months.current);
    await expectTouchAction(page.getByTestId("month-pager"), "pan-y");
  });

  commonScenarios("mouse");

  test("a swipe released over the bottom bar rests, and the next tap opens", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    const bar = await page.getByRole("tab", { name: "Lists" }).boundingBox();
    if (bar == null) {
      throw new Error("the bottom bar has no box");
    }

    // A short horizontal drag, then the pointer leaves the pager
    // downward and releases over the bar.
    const { at } = await dragHold(
      page,
      sectionHeader(page, sections.today),
      -dragPx.short,
    );
    await page.mouse.move(at.x, bar.y + bar.height / 2, { steps: 5 });
    await page.mouse.up();

    // The track must return, and the press guard must not stay armed.
    await page.waitForTimeout(500);
    await expect.poll(() => trackX(page)).toBe(0);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
    await press(page, row(page, undated.second).getByRole("button", { name: undated.second }));
    await expect(page).toHaveURL(/\/task\//);
  });

  test("the list preview matches the landed page", async ({ page }, testInfo) => {
    test.skip(!isMotion(testInfo), "reduce motion never mounts a preview");
    await seedErrand(page);

    // Scroll Main to its middle, so a kept live cell would land there.
    const pager = await pagerBox(page, "list-pager");
    await page.mouse.move(pager.x + pager.width / 2, pager.y + pager.height / 2);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);

    await pauseClock(page);
    let preview: Buffer | null = null;
    let previewX = Number.NaN;
    const viewport = page.viewportSize();
    if (viewport == null) {
      throw new Error("the page has no viewport");
    }
    await mouseHold(
      page,
      page.getByTestId("list-pager"),
      -Math.round(pager.width * holdShare),
      async () => {
        await frame(page);
        const cell = page.getByTestId("preview:1");
        await expect(cell).toBeVisible();
        const box = await cell.boundingBox();
        if (box == null) {
          throw new Error("the preview has no box");
        }
        previewX = box.x;
        preview = await page.screenshot({
          clip: pageClip(pager, previewX, viewport.height, "preview", "left"),
        });
      },
      { side: "right", steps: 10 },
    );
    await frame(page, 600);
    await page.clock.resume();
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await expect(row(page, "Preview errand")).toBeVisible();
    await page.waitForTimeout(500);
    // The landed list mounts at its top, as its preview drew it.
    expect(await pagerScrollTop(page, "list-pager")).toBe(0);

    await expectSamePicture(
      page,
      testInfo,
      pager,
      previewX,
      "left",
      preview as unknown as Buffer,
    );
  });

  test("the day preview matches the landed page", async ({ page }, testInfo) => {
    test.skip(!isMotion(testInfo), "reduce motion never mounts a preview");
    await dayScreenshots(page, testInfo, (target, dx, side, during) =>
      mouseHold(page, target, dx, during, { side, steps: 10 }),
    );
  });

  test("reduce motion keeps the track still and commits on release", async ({ page }, testInfo) => {
    test.skip(isMotion(testInfo), "the motion project follows the finger");
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await pauseClock(page);
    await mouseHold(page, sectionHeader(page, sections.today), -dragPx.flick, async () => {
      await frame(page);
      expect(await trackX(page)).toBe(0);
    });
    await frame(page, 32);
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await expect.poll(async () => (await liveOffset(page, "list-pager")).x).toBe(0);
    await page.clock.resume();
  });

  test("reduce motion changes the page at once on a tab tap", async ({ page }, testInfo) => {
    test.skip(isMotion(testInfo), "the motion project slides");
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await pauseClock(page);
    await listTab(page, tabs.next).click();
    await frame(page);
    await expect.poll(async () => (await liveOffset(page, "list-pager")).x).toBe(0);
    await page.clock.resume();
  });

  test("the tab strip does not slide with reduce motion", async ({ page }, testInfo) => {
    test.skip(isMotion(testInfo), "the motion project slides the strip");
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    const read = await page.evaluate(async () => {
      const list = document.querySelector('[role="tablist"]');
      if (list == null) {
        throw new Error("the tab strip is missing");
      }
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      const work = tabs.find((tab) => tab.textContent === "Work");
      if (work == null) {
        throw new Error("the Work tab is missing");
      }
      const listRect = list.getBoundingClientRect();
      const tabRect = work.getBoundingClientRect();
      const offset = Math.round(tabRect.left - listRect.left + list.scrollLeft);
      const maxScroll = Math.max(0, list.scrollWidth - list.clientWidth);
      (work as HTMLElement).click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return { offset, maxScroll, scrollLeft: Math.round(list.scrollLeft) };
    });

    expect(read.offset, "the target tab sits past the strip's edge").toBeGreaterThan(200);
    // The strip scrolls the selected tab in, less one fade width, and
    // the browser stops at the content's end.
    const target = Math.min(Math.max(0, read.offset - 30), read.maxScroll);
    expect(
      read.scrollLeft,
      "the strip jumps to the selected tab instead of animating",
    ).toBeGreaterThanOrEqual(target - 4);
  });
});

test.describe("with a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("the three pager hosts take a vertical pan", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    await expectTouchAction(page.getByTestId("list-pager"), "pan-y");

    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    await expectTouchAction(page.getByTestId("day-pager"), "pan-y");

    await page.getByRole("tab", { name: "Month", exact: true }).click();
    await expect(page.getByTestId("month-title")).toHaveText(months.current);
    await expectTouchAction(page.getByTestId("month-pager"), "pan-y");
  });

  commonScenarios("touch");

  test("a touch drag that ends in touchCancel keeps the tab", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await touchCancel(page, sectionHeader(page, sections.today), "left");

    await page.waitForTimeout(500);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "false");
  });

  test("a vertical touch drag with sideways drift scrolls and never pages", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await touchDrift(
      page,
      sectionHeader(page, sections.today),
      -dragPx.driftY,
      dragPx.driftX,
    );

    await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("preview:1")).toHaveCount(0);
  });

  test("the list preview matches the landed page on touch", async ({ page }, testInfo) => {
    test.skip(!isMotion(testInfo), "reduce motion never mounts a preview");
    await seedErrand(page);

    const pager = await pagerBox(page, "list-pager");
    await page.mouse.move(pager.x + pager.width / 2, pager.y + pager.height / 2);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);

    await pauseClock(page);
    const viewport = page.viewportSize();
    if (viewport == null) {
      throw new Error("the page has no viewport");
    }
    let preview: Buffer | null = null;
    let previewX = Number.NaN;
    await touchHold(
      page,
      page.getByTestId("list-pager"),
      -Math.round(pager.width * holdShare),
      async () => {
        await frame(page);
        const cell = page.getByTestId("preview:1");
        await expect(cell).toBeVisible();
        const box = await cell.boundingBox();
        if (box == null) {
          throw new Error("the preview has no box");
        }
        previewX = box.x;
        preview = await page.screenshot({
          clip: pageClip(pager, previewX, viewport.height, "preview", "left"),
        });
      },
      { side: "right", steps: 10 },
    );
    await frame(page, 600);
    await page.clock.resume();
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await expect(row(page, "Preview errand")).toBeVisible();
    await page.waitForTimeout(500);
    await expectSamePicture(
      page,
      testInfo,
      pager,
      previewX,
      "left",
      preview as unknown as Buffer,
    );
  });

  test("the day preview matches the landed page on touch", async ({ page }, testInfo) => {
    test.skip(!isMotion(testInfo), "reduce motion never mounts a preview");
    await dayScreenshots(page, testInfo, (target, dx, side, during) =>
      touchHold(page, target, dx, during, { side, steps: 10 }),
    );
  });

  test("reduce motion keeps the touch track still and commits on release", async ({ page }, testInfo) => {
    test.skip(isMotion(testInfo), "the motion project follows the finger");
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await pauseClock(page);
    await touchHold(page, sectionHeader(page, sections.today), -dragPx.flick, async () => {
      await frame(page);
      expect(await trackX(page)).toBe(0);
    });
    await frame(page, 32);
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await expect.poll(async () => (await liveOffset(page, "list-pager")).x).toBe(0);
    await page.clock.resume();
  });
});

/** What one frame of a settle shows. */
type FrameState = { preview: number; x: number; text: string | null };

/** Steps 20 frames of the settle and reads each one. */
async function settleFrames(
  page: Page,
  testID: string,
  headingID: string,
): Promise<FrameState[]> {
  const frames: FrameState[] = [];
  for (let i = 0; i < 20; i++) {
    await frame(page);
    const [preview, offset, text] = await Promise.all([
      page.getByTestId("preview:1").count(),
      liveOffset(page, testID),
      page.getByTestId(headingID).textContent(),
    ]);
    frames.push({ preview, x: offset.x, text });
  }
  return frames;
}

/**
 * The commit swaps the content and the page's place in one frame: from
 * the first frame that shows `next`, the live page sits at the pager's
 * origin, no preview covers it, and the old page never comes back. No
 * frame is blank: each one shows the neighbour or the live page in
 * place.
 */
function expectOneFrameCommit(frames: FrameState[], next: string) {
  const commit = frames.findIndex((frame) => frame.text?.includes(next) ?? false);
  expect(commit, `a frame shows ${next}`).toBeGreaterThanOrEqual(0);
  for (const [index, frame] of frames.entries()) {
    expect(
      frame.preview > 0 || frame.x === 0,
      `frame ${index} shows the neighbour or the live page in place`,
    ).toBe(true);
    if (index < commit) {
      continue;
    }
    expect(frame.text, `frame ${index} shows the new page`).toContain(next);
    expect(frame.x, `frame ${index} sits at the pager's origin`).toBe(0);
    expect(frame.preview, `frame ${index} holds no preview`).toBe(0);
  }
}

test("a day swipe swaps the page and its place in one frame", async ({ page }) => {
  await page.goto("/planner");
  await expect(page.getByTestId("day-heading")).toBeVisible();
  const box = await pagerBox(page, "day-pager");

  await pauseClock(page);
  await mouseHold(
    page,
    page.getByTestId("day-pager"),
    -Math.round(box.width * holdShare),
    async () => {
      await frame(page);
    },
  );
  const frames = await settleFrames(page, "day-pager", "day-heading");
  await page.clock.resume();

  expectOneFrameCommit(frames, tomorrow.heading);
  await expect(page.getByTestId("day-heading")).toContainText(tomorrow.heading);
});

test("a month swipe swaps the page and its place in one frame", async ({ page }) => {
  await page.goto("/planner");
  await page.getByRole("tab", { name: "Month", exact: true }).click();
  await expect(page.getByTestId("month-title")).toHaveText(months.current);
  const box = await pagerBox(page, "month-pager");

  await pauseClock(page);
  await mouseHold(
    page,
    page.getByTestId("month-pager"),
    -Math.round(box.width * holdShare),
    async () => {
      await frame(page);
    },
  );
  const frames = await settleFrames(page, "month-pager", "month-title");
  await page.clock.resume();

  expectOneFrameCommit(frames, months.next);
  await expect(page.getByTestId("month-title")).toHaveText(months.next);
});

test("a page lays out at the pager's origin, so Android can read it", async ({ page }) => {
  // Android's virtualized list clips a page's rows against its layout
  // box. A page laid out one width over is offscreen for that check, so
  // TalkBack and uiautomator lose every row, although the transform
  // draws the page at 0. The painted box reads 0 either way, so read
  // the layout offset.
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  const layoutX = () =>
    page
      .getByTestId("pager-live")
      .evaluate((element) => (element as HTMLElement).offsetLeft);
  expect(await layoutX()).toBe(0);

  await press(page, listTab(page, focus));
  await expect(listTab(page, focus)).toHaveAttribute("aria-selected", "true");
  expect(await layoutX()).toBe(0);
});
