import { expect, test } from "../fixtures";
import {
  bareKindNote,
  completedNotes,
  rename,
  sections,
  undated,
} from "../data";
import {
  completedToggle,
  expectInSection,
  openCompleted,
  press,
  row,
  sectionHeader,
  useDueOrder,
} from "../locators";
import { noteText } from "../vault";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(row(page, undated.second)).toBeVisible();
  await useDueOrder(page);
});

test("a note with a bare kind reads as a task and keeps that kind", async ({ page }) => {
  const target = row(page, bareKindNote.name);
  await expect(target).toBeVisible();

  await press(page, target.getByRole("checkbox"));

  await expect
    .poll(() => noteText(page, bareKindNote.path))
    .toContain("completed: 2026-10-26T");
  expect(await noteText(page, bareKindNote.path)).toContain("kind: tasks");

  // The ticked row joins the folded group, and still reads as done.
  await expect(row(page, bareKindNote.name)).toHaveCount(0);
  await openCompleted(page);
  await expect(
    row(page, bareKindNote.name).getByRole("checkbox"),
  ).toHaveAttribute("aria-checked", "true");
});

test("a tick writes the minute it landed", async ({ page }) => {
  const target = row(page, undated.second);

  await press(page, target.getByRole("checkbox"));

  await expect
    .poll(() => noteText(page, `Tasks/${undated.second}.md`))
    .toMatch(/^completed: 2026-10-26T\d{2}:\d{2}/m);
});

test("a completion with a time and one with a date alone both read as done", async ({
  page,
}) => {
  await openCompleted(page);
  for (const name of [completedNotes.timed, completedNotes.dated]) {
    await expectInSection(
      row(page, name),
      sectionHeader(page, sections.completed),
    );
  }
});

test("a tick folds the task away into Completed", async ({ page }) => {
  const target = row(page, undated.second);

  await press(page, target.getByRole("checkbox"));

  // The row holds for the wash, then joins the folded group. The
  // header counts it, so the done task leaves the page but not the tab.
  await expect(target).toHaveCount(0);
  await expect(completedToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("button", { name: /^Completed \d+ tasks?$/ }),
  ).toBeVisible();

  await openCompleted(page);
  await expectInSection(
    row(page, undated.second),
    sectionHeader(page, sections.completed),
  );
});

test("an untick puts the task back under No date", async ({ page }) => {
  await openCompleted(page);
  const target = row(page, undated.second);
  await press(page, target.getByRole("checkbox"));
  await expectInSection(target, sectionHeader(page, sections.completed));

  await press(page, target.getByRole("checkbox"));

  await expect(target.getByRole("checkbox")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expectInSection(
    target,
    sectionHeader(page, sections.undated),
    sectionHeader(page, sections.completed),
  );
});

test("a single-line row has equal space above and below its name", async ({ page }) => {
  // ADR 0012: a row pads its text the same on both sides. The row once
  // drew an empty meta row under the name, which added 2 px below it.
  const target = row(page, undated.second);

  // Every sample task is new, so each row lands on load and moves for
  // 220 ms. Two separate reads can catch the row in two places. One
  // read takes both boxes from the same frame, and the landing moves
  // them together.
  const { above, below } = await target.evaluate((outer, text) => {
    const label = [...outer.querySelectorAll("*")].find(
      (node) => node.children.length === 0 && node.textContent === text,
    );
    if (label == null) {
      throw new Error(`no label reads "${text}"`);
    }
    const box = outer.getBoundingClientRect();
    const name = label.getBoundingClientRect();
    return { above: name.top - box.top, below: box.bottom - name.bottom };
  }, undated.second);

  expect(below).toBeCloseTo(above, 0);
});

test("the editor writes a new name when the sheet closes", async ({ page }) => {
  await press(page, row(page, rename.from).getByRole("button", { name: rename.from }));
  const name = page.getByRole("textbox", { name: "Task name" });
  await expect(name).toHaveValue(rename.from);

  await name.fill(rename.to);
  // The title writes on blur and on close, never per keystroke.
  await page.getByRole("button", { name: "close the task" }).click();

  await expect(page).toHaveURL("/");
  await expect(row(page, rename.to)).toBeVisible();
  await expect(row(page, rename.from)).toHaveCount(0);
  // The rename writes a new file named for the title, so the note
  // carries no separate title key.
  await expect
    .poll(() => noteText(page, `Tasks/${rename.to}.md`))
    .toContain('kind: "[[tasks]]"');
  expect(await noteText(page, `Tasks/${rename.from}.md`)).toBeNull();
});
