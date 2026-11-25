import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { board } from "../data";
import { holdDrag, holdDragTo } from "../gestures";
import {
  expectAbove,
  expectBefore,
  listTab,
  press,
  row,
  sectionHeader,
  useDueOrder,
} from "../locators";
import { noteText, returnToTab } from "../vault";

/**
 * Ticket 20261124-deed-board: the Board is a Lists tab that groups
 * deeds by status. Settings adds it, a header drop moves a status in one
 * note write, a grip drag orders a group, Done writes `completed`, a
 * blocked deed shows its blocker, and capture makes a backlog deed.
 */

const query = `vault=${board.seed}`;

function header(page: Page, status: keyof typeof board.groups) {
  return page.getByTestId(`board-header:${status}`);
}

function grip(page: Page, name: string) {
  return page.getByTestId(`board-grip:${name}`);
}

/** Open Settings from the Lists menu, as a thumb would. */
async function openSettings(page: Page) {
  await press(page, page.getByRole("button", { name: "list menu" }));
  await press(page, page.getByRole("menuitem", { name: "Settings" }));
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

/** Switch the Board on in Settings, then come back to Lists. */
async function enableBoard(page: Page) {
  await openSettings(page);
  await press(page, page.getByRole("switch", { name: "Board" }));
  await page.goBack();
  await expect(listTab(page, board.tab)).toBeVisible();
}

/** Load the board seed and open the Board through the user's own path. */
async function openBoard(page: Page) {
  await page.goto(`/?${query}`);
  await expect(page.getByTestId("lists-toolbar")).toBeVisible();
  await enableBoard(page);
  await press(page, listTab(page, board.tab));
  await expect(header(page, "active")).toBeVisible();
  await expect(row(page, board.active.first)).toBeVisible();
}

test("Settings adds the Board after Main, and the choice survives a reload", async ({
  page,
}) => {
  await page.goto(`/?${query}`);
  await expect(page.getByTestId("lists-toolbar")).toBeVisible();
  await expect(listTab(page, board.tab)).toHaveCount(0);

  await enableBoard(page);
  await expectBefore(listTab(page, "Main"), listTab(page, board.tab));

  await page.reload();
  await expect(page.getByTestId("lists-toolbar")).toBeVisible();
  await expect(listTab(page, board.tab)).toBeVisible();

  await openSettings(page);
  await expect(page.getByRole("switch", { name: "Board" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await press(page, page.getByRole("switch", { name: "Board" }));
  await page.goBack();
  await expect(listTab(page, board.tab)).toHaveCount(0);
});

test("the board stacks Active, Backlog and Someday, and folds the end", async ({
  page,
}) => {
  await openBoard(page);

  await expectBefore(header(page, "active"), header(page, "backlog"));
  await expectBefore(header(page, "backlog"), header(page, "someday"));
  await expectBefore(header(page, "someday"), header(page, "done"));
  await expectBefore(header(page, "done"), header(page, "dropped"));

  // The three open groups hold their cards, in manual order.
  await expectAbove(
    row(page, board.active.first),
    row(page, board.active.second),
  );
  await expect(row(page, board.filed)).toBeVisible();
  await expect(sectionHeader(page, board.groups.active)).toBeVisible();

  // Done and Dropped start folded, and one press opens only its group.
  const doneToggle = header(page, "done").getByRole("button");
  await expect(doneToggle).toHaveAttribute("aria-expanded", "false");
  await expect(row(page, board.done)).toHaveCount(0);

  await press(page, doneToggle);
  await expect(doneToggle).toHaveAttribute("aria-expanded", "true");
  await expect(row(page, board.done)).toBeVisible();
  await expect(row(page, board.dropped)).toHaveCount(0);
});

test("a drag inside a group writes order, and it survives a reload", async ({
  page,
}) => {
  await openBoard(page);

  await holdDrag(page, grip(page, board.active.second), row(page, board.active.first), {
    at: "upper",
    holdMs: 0,
  });

  await expect
    .poll(async () => noteText(page, board.notes.ship))
    .toContain("order: 1");
  await expectAbove(
    row(page, board.active.second),
    row(page, board.active.first),
  );

  await returnToTab(page);
  await expect(row(page, board.active.second)).toBeVisible();
  await expectAbove(
    row(page, board.active.second),
    row(page, board.active.first),
  );
});

test("a drag released outside the groups writes nothing", async ({ page }) => {
  await openBoard(page);

  const before = {
    water: await noteText(page, board.notes.water),
    ship: await noteText(page, board.notes.ship),
  };
  expect(before.water).toContain("order: 1");
  expect(before.ship).toContain("order: 2");

  // Scroll the picked card into view first, then read where the page
  // put the first group. The release point is the page's own top
  // padding, above every header and card.
  const picked = grip(page, board.active.first);
  await picked.scrollIntoViewIfNeeded();
  const group = await header(page, "active").boundingBox();
  const pager = await page.getByTestId("list-pager").boundingBox();
  if (group == null || pager == null) {
    throw new Error("the board is not laid out");
  }
  const outside = { x: group.x + group.width / 2, y: group.y - 4 };
  expect(outside.y).toBeGreaterThan(pager.y);
  expect(outside.y).toBeLessThan(group.y);

  // The rendered page holds no group or card at that point, so the drop
  // takes the outside path rather than a same-status drop.
  const onGroup = await page.evaluate(({ x, y }) => {
    const groups =
      '[data-testid^="board-header:"], [data-testid^="board-card:"]';
    return document
      .elementsFromPoint(x, y)
      .some((element) => element.closest(groups) != null);
  }, outside);
  expect(onGroup).toBe(false);

  await holdDragTo(page, picked, outside, { holdMs: 0 });
  // Pin the pickup, so a release that never lifted cannot pass.
  await expect(page.getByTestId("drag-ghost")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("drag-ghost")).toHaveCount(0);

  // A fresh vault read settles any write. The rows and both notes stay
  // exactly as they were.
  await returnToTab(page);
  await expect(row(page, board.active.first)).toBeVisible();
  await expectAbove(
    row(page, board.active.first),
    row(page, board.active.second),
  );
  expect(await noteText(page, board.notes.water)).toBe(before.water);
  expect(await noteText(page, board.notes.ship)).toBe(before.ship);
  expect(await noteText(page, board.notes.water)).toContain("order: 1");
  expect(await noteText(page, board.notes.ship)).toContain("order: 2");
});

test("a drop on another group's header moves the status in one write", async ({
  page,
}) => {
  await openBoard(page);

  await holdDrag(page, grip(page, board.someday), header(page, "backlog"), {
    holdMs: 0,
  });

  await expect
    .poll(async () => noteText(page, board.notes.lathe))
    .toContain('status: "[[backlog]]"');
  expect(await noteText(page, board.notes.lathe)).toContain("order: 0");

  // The card lands first in Backlog, so the drop's order reads.
  await expectAbove(row(page, board.someday), row(page, board.backlog.blocker));
});

test("a drop on Done writes completed", async ({ page }) => {
  await openBoard(page);

  await holdDrag(page, grip(page, board.active.first), header(page, "done"), {
    holdMs: 0,
  });

  await expect
    .poll(async () => noteText(page, board.notes.water))
    .toContain('status: "[[done]]"');
  expect(await noteText(page, board.notes.water)).toMatch(
    /^completed: 2026-10-26T/m,
  );
  await expect(row(page, board.active.first)).toHaveCount(0);
});

test("a blocked deed shows its blocker and still drags", async ({ page }) => {
  await openBoard(page);

  const blocked = row(page, board.active.second);
  await expect(page.getByTestId(`blocked-rail:${board.active.second}`)).toBeVisible();
  await expect(blocked.getByText(board.backlog.blocker)).toBeVisible();
  await expect(
    blocked.getByRole("button", {
      name: new RegExp(`blocked by ${board.backlog.blocker}$`),
    }),
  ).toBeVisible();

  await holdDrag(page, grip(page, board.active.second), header(page, "someday"), {
    holdMs: 0,
  });
  await expect
    .poll(async () => noteText(page, board.notes.ship))
    .toContain('status: "[[someday]]"');
});

test("a due date sort turns the drag off", async ({ page }) => {
  await openBoard(page);
  await expect(grip(page, board.active.first)).toBeVisible();

  await useDueOrder(page);

  await expect(page.getByTestId(/^board-grip:/)).toHaveCount(0);
});

test("the editor's Status field moves a deed", async ({ page }) => {
  await openBoard(page);

  await press(
    page,
    row(page, board.active.first).getByRole("button", {
      name: board.active.first,
    }),
  );
  const editor = page.getByRole("dialog", { name: "Task" });
  await expect(editor).toBeVisible();
  await press(page, editor.getByRole("button", { name: "change status" }));
  await press(page, page.getByRole("button", { name: "Someday", exact: true }));

  await expect
    .poll(async () => noteText(page, board.notes.water))
    .toContain('status: "[[someday]]"');
});

test("a capture on Board writes a backlog deed", async ({ page }) => {
  await openBoard(page);

  await press(page, page.getByRole("button", { name: "add task" }));
  await expect(
    page.getByRole("button", { name: "target list: Board" }),
  ).toBeVisible();
  await page.getByPlaceholder("Add a task").fill(board.capture);
  await press(page, page.getByRole("button", { name: "send task" }));

  await expect
    .poll(async () => noteText(page, `Tasks/${board.capture}.md`))
    .toContain('status: "[[backlog]]"');
  const written = (await noteText(page, `Tasks/${board.capture}.md`)) as string;
  expect(written).not.toContain("list:");
  await expect(row(page, board.capture)).toBeVisible();
});
