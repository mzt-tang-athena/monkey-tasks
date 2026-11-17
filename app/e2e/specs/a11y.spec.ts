import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { months, supplements, tabs, tomorrow, undated } from "../data";
import { expectAbove, press, row } from "../locators";
import { smallTargets } from "../targets";
import { rgb, setTheme } from "../theme";
import { THEMES } from "../../src/theme/palettes";
import {
  failNextCreate,
  failNextWrite,
  noteText,
  putNote,
  returnToTab,
} from "../vault";

/**
 * Ticket 0063: names, states, touch targets, alerts, the non-drag
 * reorder and focus. The axe scan sits at the end.
 */

async function openLists(page: Page) {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
}

async function openPlanner(page: Page, mode: "day" | "week" | "month") {
  await page.goto("/planner");
  await expect(page.getByTestId("day-heading")).toBeVisible();
  if (mode !== "day") {
    const name = mode === "week" ? "Week" : "Month";
    await page.getByRole("tab", { name, exact: true }).click();
  }
  if (mode === "week") {
    await expect(
      page.getByRole("button", { name: tomorrow.short }),
    ).toBeVisible();
  }
  if (mode === "month") {
    await expect(page.getByTestId("month-title")).toBeVisible();
  }
}

async function expectTargets(page: Page) {
  expect(await smallTargets(page)).toEqual([]);
}

/** The Journal tab at 360, on today's note. */
async function openJournal(page: Page) {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Journal", exact: true }).click();
  await expect(page.getByTestId("journal-screen")).toBeVisible();
  await expect(page.getByText("Woke up early, before the alarm")).toBeVisible();
}

/** Switch palette and wait for the page to repaint in it. */
async function usePalette(page: Page, name: "budget" | "midnight") {
  await setTheme(page, name);
  await expect
    .poll(() =>
      page
        .getByTestId("journal-screen")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe(rgb(THEMES[name].paper));
}

/** The open entry composer, once its entrance has landed. */
async function openEntryComposer(page: Page) {
  await press(page, page.getByRole("button", { name: "add entry" }));
  await expect(page.getByRole("dialog", { name: "Write an entry" })).toBeVisible();
  const send = page.getByRole("button", { name: "send entry" });
  await expect
    .poll(async () => (await send.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(43.9);
}

test.describe("row names and states", () => {
  test("a row body is named by its task and its meta", async ({ page }) => {
    await openLists(page);

    await expect(
      row(page, supplements).getByRole("button", {
        name: `${supplements}, 7:00 PM`,
      }),
    ).toBeVisible();
  });

  test("a month cell with tasks says so in its name, and a pick selects it", async ({
    page,
  }) => {
    await openPlanner(page, "month");
    const grid = page.getByRole("grid", { name: months.current });
    const cell = grid.getByRole("gridcell", { name: /Monday 26, \d+ tasks?/ });

    await expect(cell).toHaveAttribute("aria-selected", "false");
    await press(page, cell);
    await expect(cell).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("states", () => {
  test("the selected period strip cell is a selected tab", async ({ page }) => {
    await openPlanner(page, "day");
    const days = page.getByRole("tablist", { name: "days" });

    await expect(
      days.getByRole("tab", { name: "Mon 26" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      days.getByRole("tab", { name: "Tue 27" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  test("the selected month strip cell is a selected tab", async ({ page }) => {
    await openPlanner(page, "month");
    const monthsRail = page.getByRole("tablist", { name: "months" });

    await expect(
      monthsRail.getByRole("tab", { name: months.currentCell }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      monthsRail.getByRole("tab", { name: months.nextCell }),
    ).toHaveAttribute("aria-selected", "false");
  });

  test("the sort button reports its menu's expanded state", async ({ page }) => {
    await openLists(page);
    const sort = page.getByRole("button", { name: "sort list" });

    await expect(sort).toHaveAttribute("aria-expanded", "false");
    await press(page, sort);
    await expect(sort).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("radiogroup", { name: "Sort list" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sort).toHaveAttribute("aria-expanded", "false");
  });

  test("the list menu button reports its menu's expanded state", async ({ page }) => {
    await openLists(page);
    const menu = page.getByRole("button", { name: "list menu" });

    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await press(page, menu);
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  test("the sort options are radios in a radiogroup", async ({ page }) => {
    await openLists(page);
    await press(page, page.getByRole("button", { name: "sort list" }));

    const group = page.getByRole("radiogroup", { name: "Sort list" });
    await expect(
      group.getByRole("radio", { name: "Due date Soonest first", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      group.getByRole("radio", {
        name: "My order Drag rows to sort",
        exact: true,
      }),
    ).toHaveAttribute("aria-checked", "false");
  });

  test("each tab group sits in a tablist", async ({ page }) => {
    await openLists(page);
    await expect(page.getByRole("tablist", { name: "Lists" })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "screens" })).toBeVisible();

    await openPlanner(page, "day");
    await expect(page.getByRole("tablist", { name: "planner mode" })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "task form" })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "days" })).toBeVisible();
  });

  test("each editor field is named by its label", async ({ page }) => {
    await openLists(page);
    await press(
      page,
      row(page, undated.second).getByRole("button", { name: undated.second }),
    );
    const editor = page.getByRole("dialog", { name: "Task" });
    await expect(
      editor.getByRole("textbox", { name: "Task name", exact: true }),
    ).toBeVisible();

    // Each picker's one field carries its own name.
    await press(page, editor.getByRole("button", { name: /^change list/ }));
    await expect(
      page.getByRole("textbox", { name: "Find a list", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await press(page, editor.getByRole("button", { name: "add repeat" }));
    await press(page, page.getByRole("button", { name: /^Advanced/ }));
    await expect(
      page.getByRole("textbox", { name: "Repeat rule", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await press(page, editor.getByRole("button", { name: /note$/ }));
    await expect(
      page.getByRole("textbox", { name: "Note", exact: true }),
    ).toBeVisible();
  });
});

test.describe("touch targets", () => {
  test("Lists", async ({ page }) => {
    await openLists(page);
    await expectTargets(page);
  });

  test("Planner in day mode", async ({ page }) => {
    await openPlanner(page, "day");
    await expectTargets(page);
  });

  test("Planner in week mode", async ({ page }) => {
    await openPlanner(page, "week");
    await expectTargets(page);
  });

  test("Planner in month mode", async ({ page }) => {
    await openPlanner(page, "month");
    await expectTargets(page);
  });

  test("the editor", async ({ page }) => {
    await openLists(page);
    await press(
      page,
      row(page, undated.second).getByRole("button", { name: undated.second }),
    );
    const editor = page.getByRole("dialog", { name: "Task" });
    await expect(
      editor.getByRole("textbox", { name: "Task name", exact: true }),
    ).toBeVisible();
    await expect(editor).toHaveCSS("opacity", "1");
    await expectTargets(page);
  });

  test("the open capture sheet", async ({ page }) => {
    await openLists(page);
    await press(page, page.getByRole("button", { name: "add task" }));
    await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
    // The panel's entrance scales it up to full size. Measure once it
    // has landed.
    const send = page.getByRole("button", { name: "send task" });
    await expect
      .poll(async () => (await send.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(43.9);
    await expectTargets(page);
  });

  for (const palette of ["budget", "midnight"] as const) {
    test(`Journal in ${palette}`, async ({ page }) => {
      await openJournal(page);
      await usePalette(page, palette);
      await expectTargets(page);
    });

    test(`the open entry composer in ${palette}`, async ({ page }) => {
      await openJournal(page);
      await usePalette(page, palette);
      await openEntryComposer(page);
      await expectTargets(page);
    });
  }

  test("Settings", async ({ page }) => {
    await openLists(page);
    await press(page, page.getByRole("button", { name: "list menu" }));
    await press(page, page.getByRole("menuitem", { name: "Settings" }));
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expectTargets(page);
  });

  test("the month cell reaches 44 by 44 at 360pt", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openPlanner(page, "month");
    const cell = page.getByRole("gridcell", { name: /Monday 26/ });
    const box = await cell.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(43.5);
    expect(box!.height).toBeGreaterThanOrEqual(43.5);
  });
});

test.describe("errors announce", () => {
  test("a list write error is an alert", async ({ page }) => {
    await openLists(page);
    await failNextWrite(page, `${undated.second}.md`);

    await press(page, row(page, undated.second).getByRole("checkbox"));

    await expect(
      page.getByRole("alert").filter({ hasText: "not saved" }),
    ).toContainText("not saved");
  });

  test("the repair notice is an alert", async ({ page }) => {
    await openLists(page);
    await putNote(
      page,
      "Tasks/Broken note.md",
      '---\nkind: "[[tasks]]"\n---\n\nNo created date.\n',
    );
    await returnToTab(page);

    await expect(
      page.getByRole("alert").filter({ hasText: "Needs repair" }),
    ).toBeVisible();
  });

  test("the editor save error is an alert", async ({ page }) => {
    await openLists(page);
    await press(
      page,
      row(page, undated.second).getByRole("button", { name: undated.second }),
    );
    await failNextWrite(page, `${undated.second}.md`);

    // The sheet writes each change, so a picked day is the save.
    await press(page, page.getByRole("button", { name: "add due date" }));
    await press(page, page.getByRole("button", { name: "Tomorrow" }));

    await expect(
      page.getByRole("alert").filter({ hasText: "Not saved" }),
    ).toBeVisible();
  });

  test("the capture failure toast is an alert", async ({ page }) => {
    await openLists(page);
    await failNextCreate(page, "Buy stamps for card.md");
    await press(page, page.getByRole("button", { name: "add task" }));
    await page.getByPlaceholder("Add a task").fill("Buy stamps for card");
    await press(page, page.getByRole("button", { name: "send task" }));

    await expect(
      page.getByRole("alert").filter({ hasText: "create failed" }),
    ).toBeVisible();
  });
});

test.describe("non-drag paths", () => {
  test("the grip is a slider whose steps move the row one place and write the order", async ({
    page,
  }) => {
    await openLists(page);
    await press(page, page.getByRole("button", { name: "sort list" }));
    await press(
      page,
      page.getByRole("radio", { name: "My order Drag rows to sort" }),
    );
    await expectAbove(row(page, undated.first), row(page, undated.second));

    const grip = page.getByRole("slider", {
      name: `reorder ${undated.first}`,
    });
    await expect(grip).toHaveAttribute("aria-valuenow", "1");

    // Arrow down is the increment action: one place down the list.
    await grip.focus();
    await expect(grip).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expectAbove(row(page, undated.second), row(page, undated.first));
    await expect
      .poll(() => noteText(page, `Tasks/${undated.first}.md`))
      .toContain("order: 2");
    await expect
      .poll(() => noteText(page, `Tasks/${undated.second}.md`))
      .toContain("order: 1");
    await expect(grip).toHaveAttribute("aria-valuenow", "2");

    // Arrow up is the decrement action, and it lands the row back.
    await page.keyboard.press("ArrowUp");
    await expectAbove(row(page, undated.first), row(page, undated.second));
    await expect
      .poll(() => noteText(page, `Tasks/${undated.first}.md`))
      .toContain("order: 1");
    await expect
      .poll(() => noteText(page, `Tasks/${undated.second}.md`))
      .toContain("order: 2");
  });

  test("the split grabber is adjustable and its actions move it one hour row", async ({
    page,
  }) => {
    await openPlanner(page, "day");
    const slider = page.getByRole("slider", { name: "resize timeline" });
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute("aria-valuenow", /\d+/);

    const top = page.getByTestId("day-split:top");
    const before = (await top.boundingBox())?.height ?? 0;
    await slider.focus();
    await expect(slider).toBeFocused();
    await page.keyboard.press("ArrowDown");

    await expect.poll(async () => (await top.boundingBox())?.height ?? 0).toBeLessThan(
      before - 30,
    );
    await page.keyboard.press("ArrowUp");
    await expect
      .poll(async () => Math.abs(((await top.boundingBox())?.height ?? 0) - before))
      .toBeLessThan(2);
  });
});

test.describe("overlays", () => {
  test("a menu moves focus into it and back to its button", async ({ page }) => {
    await openLists(page);
    const sort = page.getByRole("button", { name: "sort list" });
    await expect(sort).toHaveAttribute("aria-haspopup", "menu");

    await press(page, sort);
    await expect(page.getByRole("radiogroup", { name: "Sort list" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.getAttribute("role")),
      )
      .toBe("radio");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("radiogroup", { name: "Sort list" })).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
      )
      .toBe("sort list");
  });

  test("the screen behind a menu is inert", async ({ page }) => {
    await openLists(page);
    await expect(page.locator("[inert]")).toHaveCount(0);

    await press(page, page.getByRole("button", { name: "list menu" }));

    await expect(page.getByRole("menu", { name: "List menu" })).toBeVisible();
    await expect(page.locator("[inert]")).toHaveCount(1);
  });

  test("the capture sheet moves focus in and back to Add", async ({ page }) => {
    await openLists(page);
    const add = page.getByRole("button", { name: "add task" });
    await add.focus();
    await press(page, add);

    const dialog = page.getByRole("dialog", { name: "Add a task" });
    await expect(dialog).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document
            .querySelector('[role="dialog"]')
            ?.contains(document.activeElement) ?? false,
        ),
      )
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
      )
      .toBe("add task");
  });
});

test.describe("axe", () => {
  async function scan(page: Page, where: string, include?: string) {
    const builder = new AxeBuilder({ page });
    if (include != null) {
      builder.include(include);
    }
    const result = await builder.analyze();
    const bad = result.violations.filter(
      (finding) => finding.impact === "serious" || finding.impact === "critical",
    );
    expect(
      bad.map((finding) => ({
        id: finding.id,
        nodes: finding.nodes.map((node) => node.target.join(" ")),
      })),
      where,
    ).toEqual([]);
  }

  test("Lists", async ({ page }) => {
    await openLists(page);
    await scan(page, "lists");
  });

  test("Planner in day mode", async ({ page }) => {
    await openPlanner(page, "day");
    await scan(page, "planner day");
  });

  test("Planner in week mode", async ({ page }) => {
    await openPlanner(page, "week");
    await scan(page, "planner week");
  });

  test("Planner in month mode", async ({ page }) => {
    await openPlanner(page, "month");
    await scan(page, "planner month");
  });

  test("the editor", async ({ page }) => {
    await openLists(page);
    await press(
      page,
      row(page, undated.second).getByRole("button", { name: undated.second }),
    );
    const editor = page.getByRole("dialog", { name: "Task" });
    await expect(editor.getByRole("textbox", { name: "Task name" })).toBeVisible();
    await expect(editor).toHaveCSS("opacity", "1");
    await scan(page, "editor", '[role="dialog"]');
  });

  test("the open capture sheet", async ({ page }) => {
    await openLists(page);
    await press(page, page.getByRole("button", { name: "add task" }));
    await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
    await scan(page, "capture sheet");
  });

  for (const palette of ["budget", "midnight"] as const) {
    test(`the Journal page in ${palette} at 360`, async ({ page }) => {
      await openJournal(page);
      await usePalette(page, palette);
      await scan(page, `journal ${palette}`);
    });

    test(`the open entry composer in ${palette} at 360`, async ({ page }) => {
      await openJournal(page);
      await usePalette(page, palette);
      await openEntryComposer(page);
      await expect(page.getByRole("dialog", { name: "Write an entry" })).toHaveCSS(
        "opacity",
        "1",
      );
      await scan(page, `journal composer ${palette}`);
    });
  }
});

test("list tabs still read as tabs", async ({ page }) => {
  await openLists(page);
  await expect(
    page.getByRole("tab", { name: tabs.main, exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
