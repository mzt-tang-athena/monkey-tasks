import { expect, test } from "../fixtures";
import { sections, supplements, tabs, undated } from "../data";
import { holdDrag, swipe, touchSwipe } from "../gestures";
import { expectAbove, listTab, press, row, sectionHeader } from "../locators";
import { putNote, returnToTab } from "../vault";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
});

test.describe("tab swipe", () => {
  test("a swipe left turns to the next list", async ({ page }) => {
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");

    await swipe(page, sectionHeader(page, sections.today), "left");

    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "false");
  });

  test("a short swipe keeps the list", async ({ page }) => {
    await swipe(page, sectionHeader(page, sections.today), "left", "short");

    // The page springs back. Give it the time a slide would take, then
    // check that nothing turned.
    await page.waitForTimeout(500);
    await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "false");
  });

  test("a swipe that starts on a row does not open the editor", async ({
    page,
  }) => {
    // B1: a mouse swipe that starts on a row ends with a click on that
    // row. The press guard arms when the swipe passes its slop and
    // blocks that click.
    await swipe(page, row(page, supplements), "left");

    await expect(
      listTab(page, tabs.next),
      "the swipe turns the page, and the row's editor stays closed",
    ).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL("/");
  });

  test("a plain tap on a row still opens the editor", async ({ page }) => {
    await press(page, row(page, undated.second).getByRole("button", { name: undated.second }));

    await expect(page).toHaveURL(/\/task\//);
  });
});

test.describe("tab swipe on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("a touch swipe turns the page", async ({ page }) => {
    // B2: the pager sets `touch-action: pan-y`, so the browser leaves
    // the horizontal pan to the surface.
    await touchSwipe(page, sectionHeader(page, sections.today), "left");

    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true", {
      timeout: 2000,
    });
  });
});

test.describe("row names and states", () => {
  test("each row circle is a checkbox named by its task", async ({ page }) => {
    const tick = row(page, undated.second).getByRole("checkbox", {
      name: undated.second,
    });
    await expect(tick).toHaveAttribute("aria-checked", "false");

    await press(page, tick);

    await expect(
      row(page, undated.second).getByRole("checkbox", { name: undated.second }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("a row body is named by its task and its meta", async ({ page }) => {
    await expect(
      row(page, supplements).getByRole("button", {
        name: `${supplements}, 7:00 PM`,
      }),
    ).toBeVisible();
  });
});

test.describe("My order", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("button", { name: "sort list" }).click();
    await page.getByRole("radio", { name: "My order" }).click();
    await expectAbove(row(page, undated.first), row(page, undated.second));
  });

  test("the sort sheet marks the order in use", async ({ page }) => {
    await page.getByRole("button", { name: "sort list" }).click();

    await expect(page.getByRole("radio", { name: "My order" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("radio", { name: "Due date" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("each row has a named reorder handle", async ({ page }) => {
    // B4: the grip rendered six dots with no name.
    const grip = page.getByTestId(`reorder-grip:${undated.second}`);

    await expect(grip).toHaveRole("button");
    await expect(grip).toHaveAccessibleName("reorder handle");
    await expect(page.getByRole("button", { name: "reorder handle" }).first()).toBeVisible();
    // It has no keyboard action yet (0063), so it is no tab stop.
    await expect(grip).toHaveAttribute("tabindex", "-1");
  });

  test("a held row moves and keeps its place", async ({ page }) => {
    await holdDrag(page, row(page, undated.second), row(page, undated.first), {
      at: "upper",
    });

    await expectAbove(row(page, undated.second), row(page, undated.first));

    // The order is written, not only drawn: it survives a tab round
    // trip.
    await listTab(page, tabs.next).click();
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await listTab(page, tabs.main).click();
    await expectAbove(row(page, undated.second), row(page, undated.first));
  });

  test("the grip lifts a row without a hold", async ({ page }) => {
    await holdDrag(
      page,
      page.getByTestId(`reorder-grip:${undated.second}`),
      row(page, undated.first),
      { at: "upper", holdMs: 0 },
    );

    await expectAbove(row(page, undated.second), row(page, undated.first));
  });
});

test.describe("the tab strip", () => {
  test("a clipped tab name has a fade over its edge", async ({ page }) => {
    // At 412 wide the strip holds more tabs than fit, so the last one
    // shows cut ("Fo"). A fade tells the user that more waits there.
    await expect(page.getByTestId("tab-fade-end")).toBeVisible();
    await expect(page.getByTestId("tab-fade-start")).toHaveCount(0);

    const strip = await page.getByRole("tablist", { name: "Lists" }).boundingBox();
    if (strip == null) {
      throw new Error("the tab strip has no box");
    }
    await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2);
    await page.mouse.wheel(600, 0);

    await expect(page.getByTestId("tab-fade-end")).toHaveCount(0);
    await expect(page.getByTestId("tab-fade-start")).toBeVisible();
  });

  test("the start fade leaves the selected tab's name clear", async ({ page }) => {
    await listTab(page, tabs.next).click();
    await expect(listTab(page, tabs.next)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("tab-fade-start")).toBeVisible();

    const name = listTab(page, tabs.next).getByText(tabs.next, { exact: true });
    const left = async () => (await name.boundingBox())?.x ?? Number.NaN;
    // The strip scrolls the tab in with an animation. Wait until it rests.
    let last = Number.NaN;
    await expect
      .poll(async () => {
        const now = await left();
        const still = now === last;
        last = now;
        return still;
      })
      .toBe(true);

    const fade = await page.getByTestId("tab-fade-start").boundingBox();
    if (fade == null) {
      throw new Error("the start fade has no box");
    }
    expect(fade.x + fade.width).toBeLessThanOrEqual(await left());
  });
});

test.describe("list menu", () => {
  test("a tap on a row, with the menu open, closes the menu and opens no editor", async ({
    page,
  }) => {
    // Bug 1: the backdrop sat under the list body, so the tap reached
    // the row. The mouse clicks by position, because a click through
    // the locator waits for a row that the backdrop covers.
    await page.getByRole("button", { name: "list menu" }).click();
    await expect(page.getByText("Diagnostics")).toBeVisible();

    // Supplements sits high on the page, so the click lands on screen.
    const box = await row(page, supplements).boundingBox();
    if (box == null) {
      throw new Error("the row has no box");
    }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(page.getByText("Diagnostics")).toBeHidden();
    await expect(page).toHaveURL("/");
  });

  test("the overflow menu shows only what works", async ({ page }) => {
    // Bug 2: three items closed the menu and did nothing. Two used the
    // danger color, so a user could think a delete ran. Ticket 0065
    // builds them.
    await page.getByRole("button", { name: "list menu" }).click();

    await expect(page.getByText("Diagnostics")).toBeVisible();
    await expect(page.getByText("Rename list")).toHaveCount(0);
    await expect(page.getByText("Delete list")).toHaveCount(0);
    await expect(page.getByText("Delete all completed tasks")).toHaveCount(0);
  });
});

test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the top chrome is one band from edge to edge", async ({ page }) => {
    // Bug 3: the tab bar capped its surface at the reading measure, and
    // the status strip spanned the window, so the chrome read as an L.
    const tab = await listTab(page, tabs.main).boundingBox();
    if (tab == null) {
      throw new Error("the Main tab has no box");
    }

    const paint = await page.evaluate((y) => {
      const at = (x: number) => {
        let node = document.elementFromPoint(x, y);
        while (node != null) {
          const color = getComputedStyle(node).backgroundColor;
          if (color !== "rgba(0, 0, 0, 0)") {
            return color;
          }
          node = node.parentElement;
        }
        return "none";
      };
      return {
        left: at(2),
        middle: at(window.innerWidth / 2),
        right: at(window.innerWidth - 3),
      };
    }, tab.y + tab.height / 2);

    expect(paint.left).toBe(paint.middle);
    expect(paint.right).toBe(paint.middle);
  });
});

test.describe("a note that needs repair", () => {
  test.beforeEach(async ({ page }) => {
    await putNote(
      page,
      "Tasks/Broken note.md",
      '---\nkind: "[[tasks]]"\n---\n\nNo created date.\n',
    );
    await returnToTab(page);
    await expect(page.getByText("Needs repair")).toBeVisible();
  });

  test("the notice scrolls with the list", async ({ page }) => {
    // Bug 7: the notice sat fixed above the list, 168 points tall, and
    // cards slid under its edge. It is the list's header now.
    await page.setViewportSize({ width: 412, height: 560 });
    const notice = page.getByText("Needs repair");
    const before = (await notice.boundingBox())?.y ?? Number.NaN;

    await page.mouse.move(206, 450);
    await page.mouse.wheel(0, 150);

    await expect
      .poll(async () => (await notice.boundingBox())?.y ?? Number.NaN)
      .toBeLessThan(before - 50);
  });

  test("the notice names the file and its error", async ({ page }) => {
    await expect(page.getByText("Broken note.md")).toBeVisible();
  });
});
