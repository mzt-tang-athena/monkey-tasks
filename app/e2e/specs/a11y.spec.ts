import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { months, supplements, tabs, tomorrow, undated } from "../data";
import { press, row } from "../locators";
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

const minTarget = 44;
/** Layout boxes land on fractions of a pixel; a hair under is a pass. */
const slack = 0.5;
const widgetRoles = [
  "button",
  "tab",
  "checkbox",
  "radio",
  "option",
  "gridcell",
  "menuitem",
  "menuitemradio",
  "link",
  "switch",
  "slider",
];

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

/** Every visible widget smaller than 44 by 44, from its layout box. */
async function smallTargets(page: Page) {
  return page.evaluate(
    ({ roles, min, slack }) => {
      const small: { role: string; name: string; width: number; height: number }[] = [];
      for (const role of roles) {
        for (const element of document.querySelectorAll(`[role="${role}"]`)) {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (
            box.width === 0 ||
            box.height === 0 ||
            style.visibility === "hidden" ||
            style.display === "none"
          ) {
            continue;
          }
          if (box.width < min - slack || box.height < min - slack) {
            small.push({
              role,
              name:
                element.getAttribute("aria-label") ??
                (element.textContent ?? "").trim().slice(0, 40),
              width: Math.round(box.width * 10) / 10,
              height: Math.round(box.height * 10) / 10,
            });
          }
        }
      }
      return small;
    },
    { roles: widgetRoles, min: minTarget, slack },
  );
}

async function expectTargets(page: Page) {
  expect(await smallTargets(page)).toEqual([]);
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
    await expect(group.getByRole("radio", { name: "Due date" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(group.getByRole("radio", { name: "My order" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
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

    const labels = ["Name", "Due", "Recurrence", "Lists", "Reminders", "Body"];
    for (const label of labels) {
      await expect(
        page.getByRole("textbox", { name: label, exact: true }),
      ).toBeVisible();
    }
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
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
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

    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Call Mum back");
    await press(page, page.getByRole("button", { name: "save task" }));

    await expect(page.getByRole("alert")).toBeVisible();
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
  test("Move down on the first row in My order moves it second and writes the order", async ({
    page,
  }) => {
    await openLists(page);
    await press(page, page.getByRole("button", { name: "sort list" }));
    await press(page, page.getByRole("radio", { name: "My order" }));
    await expect.poll(async () => {
      const first = await row(page, undated.first).boundingBox();
      const second = await row(page, undated.second).boundingBox();
      return first != null && second != null && first.y < second.y;
    }).toBe(true);

    await press(
      page,
      page.getByRole("button", { name: `actions for ${undated.first}` }),
    );
    await press(page, page.getByRole("menuitem", { name: "Move down" }));

    await expect.poll(async () => {
      const first = await row(page, undated.first).boundingBox();
      const second = await row(page, undated.second).boundingBox();
      return first != null && second != null && second.y < first.y;
    }).toBe(true);

    await expect
      .poll(() => noteText(page, `Tasks/${undated.first}.md`))
      .toContain("order: 2");
    await expect
      .poll(() => noteText(page, `Tasks/${undated.second}.md`))
      .toContain("order: 1");
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
  async function scan(page: Page, where: string) {
    const result = await new AxeBuilder({ page }).analyze();
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
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
    await scan(page, "editor");
  });

  test("the open capture sheet", async ({ page }) => {
    await openLists(page);
    await press(page, page.getByRole("button", { name: "add task" }));
    await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
    await scan(page, "capture sheet");
  });
});

test("list tabs still read as tabs", async ({ page }) => {
  await openLists(page);
  await expect(
    page.getByRole("tab", { name: tabs.main, exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
