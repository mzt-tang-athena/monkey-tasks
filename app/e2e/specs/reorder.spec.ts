import type { Page } from "@playwright/test";
import { expect, pauseClock, test } from "../fixtures";
import { sections, supplements, undated } from "../data";
import {
  dragPx,
  expectTouchAction,
  holdDrag,
  pointOn,
  press,
  type Input,
} from "../gestures";
import { expectAbove, expectBefore, listTab, row, sectionHeader } from "../locators";
import { noteText } from "../vault";

/**
 * Ticket 0060: the row reorder, the tick hold and the capture landing
 * on the UI thread. A scenario that needs a particular input runs once
 * with the mouse and once with CDP touch.
 */

const inputs: Input[] = ["mouse", "touch"];

const captured = "Send invoice";
const apples = "Groceries: milk, eggs, oats";
const plan = "Plan weekend hike";

async function openMain(page: Page) {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
}

async function openMyOrder(page: Page) {
  await openMain(page);
  await page.getByRole("button", { name: "sort list" }).click();
  await page.getByRole("radio", { name: "My order" }).click();
  await expectAbove(row(page, undated.first), row(page, undated.second));
}

/** The item's own translateY, in px. The surface animates only this. */
async function offsetOf(page: Page, name: string): Promise<number> {
  return page.getByTestId(`reorder-item:${name}`).evaluate((element) => {
    const value = getComputedStyle(element).transform;
    return value === "none" ? 0 : new DOMMatrixReadOnly(value).f;
  });
}

/** Every item's offset, so a test can prove a drop left no residue. */
async function offsets(page: Page): Promise<{ name: string; y: number }[]> {
  return page.getByTestId(/^reorder-item:/).evaluateAll((elements) =>
    elements.map((element) => {
      const value = getComputedStyle(element).transform;
      return {
        name: element.getAttribute("data-testid") ?? "",
        y: value === "none" ? 0 : new DOMMatrixReadOnly(value).f,
      };
    }),
  );
}

async function expectResting(page: Page) {
  await expect
    .poll(async () => (await offsets(page)).every((item) => Math.abs(item.y) < 1))
    .toBe(true);
}

/** A row's effective opacity: its own and every ancestor's, so the
    landing's wrapper counts too. */
function watchRow(page: Page, name: string) {
  return page.evaluate((name) => {
    const key = `task-row:${name}`;
    const seen = window as unknown as {
      watch: { log: number[]; observer: MutationObserver };
    };
    const opacityOf = (node: HTMLElement) => {
      let value = 1;
      let element: HTMLElement | null = node;
      while (element != null && element !== document.body) {
        value = Math.min(value, Number(getComputedStyle(element).opacity));
        element = element.parentElement as HTMLElement | null;
      }
      return value;
    };
    const record = (node: HTMLElement) => {
      // The first painted frame after the mount.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => seen.watch.log.push(opacityOf(node)));
      });
    };
    const observer = new MutationObserver((records) => {
      for (const entry of records) {
        for (const node of entry.addedNodes) {
          if (!(node instanceof HTMLElement)) {
            continue;
          }
          if (node.getAttribute("data-testid") === key) {
            record(node);
          }
          for (const inner of node.querySelectorAll(
            `[data-testid="${key}"]`,
          )) {
            record(inner as HTMLElement);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    seen.watch = { log: [], observer };
  }, name);
}

/** The row's settled opacity: a Completed row recedes to 0.55. */
async function restingOpacity(page: Page, name: string): Promise<number> {
  await page.waitForTimeout(400);
  return row(page, name).evaluate((element) => {
    let value = 1;
    let node: HTMLElement | null = element as HTMLElement;
    while (node != null && node !== document.body) {
      value = Math.min(value, Number(getComputedStyle(node).opacity));
      node = node.parentElement as HTMLElement | null;
    }
    return value;
  });
}

async function stopWatch(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const seen = window as unknown as {
      watch: { log: number[]; observer: MutationObserver };
    };
    seen.watch.observer.disconnect();
    return seen.watch.log;
  });
}

async function capture(page: Page, typed: string, name: string) {
  await page.getByRole("button", { name: "add task" }).click();
  await page.getByPlaceholder("Add a task").fill(typed);
  await page.getByRole("button", { name: "send task" }).click();
  await expect(row(page, name)).toBeVisible();
}

const tickButton = (page: Page, name: string) =>
  row(page, name).getByRole("checkbox");

test("the pager keeps pan-y and the grip takes none", async ({ page }) => {
  await openMyOrder(page);
  await expectTouchAction(page.getByTestId("list-pager"), "pan-y");
  await expectTouchAction(
    page.getByTestId(`reorder-grip:${undated.second}`),
    "none",
  );
});

test("a tick that empties a group keeps the rows below connected", async ({
  page,
}) => {
  await openMain(page);
  const below = await row(page, undated.first).elementHandle();
  expect(below).not.toBeNull();

  // Dentist appointment is Tomorrow's only row, so ticking it empties
  // the group above No date.
  await tickButton(page, "Dentist appointment").click();
  await expect(sectionHeader(page, "Tomorrow")).toHaveCount(0);

  expect(
    await below!.evaluate((element) => element.isConnected),
    "the rows below the emptied group kept their nodes",
  ).toBe(true);
});

test.describe("the drop", () => {
  for (const input of inputs) {
    test(`a released crossing lands in the shown slot with every row at rest, ${input}`, async ({
      page,
    }) => {
      await openMyOrder(page);
      await row(page, undated.second).scrollIntoViewIfNeeded();
      const height = (await row(page, undated.first).boundingBox())?.height ?? 0;
      const point = await pointOn(page, row(page, undated.first), "upper");

      const pointer = await press(
        page,
        input,
        page.getByTestId(`reorder-grip:${undated.second}`),
        { holdMs: 0 },
      );
      await pointer.moveTo(point);
      await expect
        .poll(() => offsetOf(page, undated.second))
        .toBeLessThan(-Math.max(1, height / 2));
      await pointer.up();

      await expectAbove(row(page, undated.second), row(page, undated.first));
      await expectResting(page);
    });

    test(`a drop at the moment the offset equals the slot reorders, ${input}`, async ({
      page,
    }) => {
      await openMyOrder(page);
      await row(page, undated.second).scrollIntoViewIfNeeded();
      const first = await row(page, undated.first).boundingBox();
      const second = await row(page, undated.second).boundingBox();
      if (first == null || second == null) {
        throw new Error("the two rows have no boxes");
      }
      const point = {
        x: first.x + first.width / 2,
        y: first.y + first.height / 2,
      };

      const pointer = await press(
        page,
        input,
        page.getByTestId(`reorder-grip:${undated.second}`),
        { holdMs: 0 },
      );
      await pointer.moveTo(point);
      await expect
        .poll(() => offsetOf(page, undated.second))
        .toBeLessThan(-first.height + 1);
      await pointer.up();

      await expectAbove(row(page, undated.second), row(page, undated.first));
      await expectResting(page);
    });

    test(`a drag away and back drops in place with no toggle, ${input}`, async ({
      page,
    }) => {
      await openMyOrder(page);
      const start = await pointOn(page, row(page, undated.second));
      const away = await pointOn(page, row(page, undated.first), "upper");
      const before = await row(page, undated.first)
        .getByRole("checkbox")
        .getAttribute("aria-checked");

      const pointer = await press(
        page,
        input,
        page.getByTestId(`reorder-grip:${undated.second}`),
        { holdMs: 0 },
      );
      await pointer.moveTo(away);
      await expect
        .poll(async () => Math.abs(await offsetOf(page, undated.second)))
        .toBeGreaterThan(1);
      await pointer.moveTo(start);
      await expect.poll(() => offsetOf(page, undated.second)).toBe(0);
      await pointer.up();

      await expect(page).toHaveURL("/");
      await expectAbove(row(page, undated.first), row(page, undated.second));
      expect(
        await row(page, undated.first)
          .getByRole("checkbox")
          .getAttribute("aria-checked"),
      ).toBe(before);
      await expectResting(page);
    });
  }

  test("a grip drop writes the new order to the notes", async ({ page }) => {
    await openMyOrder(page);
    await holdDrag(
      page,
      page.getByTestId(`reorder-grip:${undated.second}`),
      row(page, undated.first),
      { at: "upper", holdMs: 0 },
    );

    await expectAbove(row(page, undated.second), row(page, undated.first));
    await expect
      .poll(() => noteText(page, `Tasks/${undated.second}.md`))
      .toContain("order: 1");
    await expect
      .poll(() => noteText(page, `Tasks/${undated.first}.md`))
      .toContain("order: 2");
  });
});

test.describe("the row body and the pager", () => {
  for (const input of inputs) {
    test(`a hold on a row body lifts nothing and the sideways drag pages, ${input}`, async ({
      page,
    }) => {
      await openMyOrder(page);
      const start = await pointOn(page, row(page, undated.second));
      const pointer = await press(page, input, row(page, undated.second), {
        holdMs: 400,
      });
      await pointer.moveTo({ x: start.x - dragPx.turn, y: start.y });
      await expect(
        page.getByTestId("drag-ghost"),
        "the row body started no drag",
      ).toHaveCount(0);
      await pointer.up();
      await expect(
        listTab(page, "Errands"),
        "the row's sideways drag turned the page",
      ).toHaveAttribute("aria-selected", "true", { timeout: 3000 });
    });

    test(`a swipe that starts on a resting row opens no editor, ${input}`, async ({
      page,
    }) => {
      await openMain(page);
      const box = await row(page, supplements).boundingBox();
      if (box == null) {
        throw new Error("the row has no box");
      }
      const width = page.viewportSize()?.width ?? 412;
      await press(page, input, row(page, supplements), {
        holdMs: 0,
        paused: true,
      }).then(async (pointer) => {
        await pointer.moveTo({ x: width / 2 - 120, y: box.y + box.height / 2 });
        await pointer.up();
        await page.clock.resume();
      });

      await expect(
        listTab(page, "Errands"),
        "the resting row still pages",
      ).toHaveAttribute("aria-selected", "true", { timeout: 3000 });
      await expect(page).toHaveURL("/");
    });
  }
});

test.describe("the tick hold", () => {
  test("two ticks 100 ms apart never move the third row", async ({
    page,
    reducedMotion,
  }) => {
    test.skip(reducedMotion === "reduce", "a reduced-motion tick regroups at once");
    await openMain(page);
    await row(page, apples).scrollIntoViewIfNeeded();

    await page.evaluate(() => {
      const seen = window as unknown as {
        samples: { second: number; third: number }[];
        stop: () => void;
      };
      seen.samples = [];
      let live = true;
      seen.stop = () => {
        live = false;
      };
      const header = [...document.querySelectorAll("div")].find((element) =>
        /^No date\s+\d+$/.test(element.textContent ?? ""),
      );
      const loop = () => {
        const second = document.querySelector(
          '[data-testid="task-row:Plan weekend hike"]',
        );
        const third = document.querySelector(
          '[data-testid="task-row:Supplements"]',
        );
        const below = header?.getBoundingClientRect().top ?? 0;
        if (
          second != null &&
          third != null &&
          second.getBoundingClientRect().top < below &&
          third.getBoundingClientRect().top < below
        ) {
          seen.samples.push({
            second: second.getBoundingClientRect().top,
            third: third.getBoundingClientRect().top,
          });
        }
        if (live) {
          requestAnimationFrame(loop);
        }
      };
      requestAnimationFrame(loop);
    });

    await pauseClock(page);
    await tickButton(page, apples).click();
    await page.clock.runFor(100);
    await tickButton(page, plan).click();
    await page.clock.runFor(350);
    await page.clock.resume();

    const samples = await page.evaluate(() => {
      const seen = window as unknown as {
        samples: { second: number; third: number }[];
        stop: () => void;
      };
      seen.stop();
      return seen.samples;
    });
    expect(samples.length).toBeGreaterThan(5);
    expect(
      samples.every((sample) => sample.third >= sample.second),
      "the third row rose above the second",
    ).toBe(true);
  });

  test("a tick sits in its group at 200 ms and in Completed at 600 ms", async ({
    page,
    reducedMotion,
  }) => {
    test.skip(reducedMotion === "reduce", "a reduced-motion tick regroups at once");
    await openMain(page);
    await pauseClock(page);
    await tickButton(page, supplements).click();
    await page.clock.runFor(200);
    await expectAbove(row(page, supplements), sectionHeader(page, sections.undated));
    await page.clock.runFor(400);
    await expectAbove(sectionHeader(page, sections.completed), row(page, supplements));
    await page.clock.resume();
  });
});

test.describe("a tick after a drop", () => {
  for (const input of inputs) {
    test(`the tick lands 100 ms after a drop, ${input}`, async ({ page }) => {
      await openMyOrder(page);
      await holdDrag(
        page,
        page.getByTestId(`reorder-grip:${undated.second}`),
        row(page, undated.first),
        { at: "upper", holdMs: 0 },
      );
      await page.waitForTimeout(100);
      await tickButton(page, apples).click();

      await expect(
        row(page, apples).getByRole("checkbox"),
      ).toHaveAttribute("aria-checked", "true");
    });
  }
});

test.describe("leaving a held row", () => {
  test("no error and no row hangs lifted", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    await openMyOrder(page);
    const point = await pointOn(
      page,
      page.getByTestId(`reorder-grip:${undated.second}`),
    );

    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForTimeout(100);
    // A tap begins with a pointer down. The drag's one-shot click guard
    // disarms on it, as it does for a real second finger.
    const tap = (name: string) => {
      const tab = [...document.querySelectorAll('[role="tab"]')].find(
        (element) => element.textContent?.trim() === name,
      ) as HTMLElement | undefined;
      tab?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      tab?.click();
    };
    await page.evaluate(tap, "Planner");
    await page.mouse.move(10, 10, { steps: 2 });
    await page.mouse.up();
    await expect(page).toHaveURL("/planner");

    await page.evaluate(tap, "Lists");
    await expect(row(page, undated.second)).toBeVisible();
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
    await expectResting(page);
  });
});

test("the capture entrance never replays within the freshness window", async ({
  page,
}) => {
  await openMain(page);
  await capture(page, captured, captured);
  const landed = row(page, captured);

  // A tick regroups the row under a completed key. The copy that mounts
  // there must show at full opacity on its first frame.
  await watchRow(page, captured);
  await tickButton(page, captured).click();
  await expectBefore(
    sectionHeader(page, sections.completed),
    row(page, captured),
  );
  await page.waitForTimeout(80);
  const tickedFrames = await stopWatch(page);
  const tickedRest = await restingOpacity(page, captured);
  if (tickedFrames.length > 0) {
    expect(Math.min(...tickedFrames)).toBeGreaterThanOrEqual(tickedRest - 0.01);
  }

  await watchRow(page, captured);
  await row(page, captured)
    .getByRole("checkbox")
    .click();
  await expectBefore(sectionHeader(page, sections.undated), row(page, captured));
  await page.waitForTimeout(80);
  const untickedFrames = await stopWatch(page);
  const untickedRest = await restingOpacity(page, captured);
  if (untickedFrames.length > 0) {
    expect(Math.min(...untickedFrames)).toBeGreaterThanOrEqual(untickedRest - 0.01);
  }

  // My order: the drag's own copy is a still preview, so no task row
  // mounts during it. The row then pages away and back.
  await page.getByRole("button", { name: "sort list" }).click();
  await page.getByRole("radio", { name: "My order" }).click();
  await expectAbove(row(page, undated.first), row(page, undated.second));
  await row(page, captured).scrollIntoViewIfNeeded();
  const previous = await page.evaluate((name) => {
    const rows = [
      ...document.querySelectorAll('[data-testid^="task-row:"]'),
    ];
    const at = rows.findIndex(
      (element) => element.getAttribute("data-testid") === `task-row:${name}`,
    );
    const before = rows[at - 1]?.getAttribute("data-testid") ?? "";
    return before.slice("task-row:".length);
  }, captured);
  expect(previous, "the captured row has a neighbour above it").not.toBe("");
  const rows = await page.getByTestId(/^task-row:/).count();
  const target = await pointOn(page, row(page, previous), "center");
  const pointer = await press(
    page,
    "mouse",
    page.getByTestId(`reorder-grip:${captured}`),
    { holdMs: 0 },
  );
  await pointer.moveTo(target);
  await expect(page.getByTestId("drag-ghost")).toBeVisible();
  expect(await page.getByTestId(/^task-row:/).count()).toBe(rows);
  await pointer.up();
  await expectAbove(row(page, captured), row(page, previous));
  await expectResting(page);

  await watchRow(page, captured);
  await listTab(page, "Errands").click();
  await expect(listTab(page, "Errands")).toHaveAttribute("aria-selected", "true");
  await listTab(page, "Main").click();
  await expect(landed).toBeVisible();
  await page.waitForTimeout(80);
  const backFrames = await stopWatch(page);
  expect(backFrames.length, "the tab return remounts the row").toBeGreaterThan(0);
  expect(Math.min(...backFrames)).toBeGreaterThanOrEqual(
    (await restingOpacity(page, captured)) - 0.01,
  );
});

test("a reduced-motion drag lands at once, a tick regroups at once, a capture rests", async ({
  page,
  reducedMotion,
}) => {
  test.skip(
    reducedMotion !== "reduce",
    "the motion project checks the slide instead",
  );
  await openMyOrder(page);
  await row(page, undated.second).scrollIntoViewIfNeeded();
  const first = await row(page, undated.first).boundingBox();
  if (first == null) {
    throw new Error("the first row has no box");
  }
  const point = {
    x: first.x + first.width / 2,
    y: first.y + first.height / 2,
  };
  const pointer = await press(
    page,
    "mouse",
    page.getByTestId(`reorder-grip:${undated.second}`),
    { holdMs: 0 },
  );
  await pointer.moveTo(point);
  await expect
    .poll(() => offsetOf(page, undated.second))
    .toBeLessThan(-Math.max(1, first.height / 2));
  await pointer.up();
  await expectAbove(row(page, undated.second), row(page, undated.first));
  await expectResting(page);

  await openMain(page);
  await tickButton(page, supplements).click();
  await expectAbove(
    sectionHeader(page, sections.completed),
    row(page, supplements),
  );

  await capture(page, captured, captured);
  const opacity = await row(page, captured).evaluate((element) => {
    let value = 1;
    let node: HTMLElement | null = element as HTMLElement;
    while (node != null && node !== document.body) {
      value = Math.min(value, Number(getComputedStyle(node).opacity));
      node = node.parentElement as HTMLElement | null;
    }
    return value;
  });
  expect(opacity, "the capture rests at full opacity").toBe(1);
});
