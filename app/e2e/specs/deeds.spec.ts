import { expect, test } from "../fixtures";
import { deeds } from "../data";
import { press, row } from "../locators";
import { noteText } from "../vault";
import { sampleSeed } from "../../src/lib/vault/sample/seed";

/**
 * A deed is a task with a status (ADR
 * `20261124-deeds-are-tasks-with-a-status`). The app reads `Deeds/`
 * beside `Tasks/`, Main shows only the tasks with no status, the
 * planner shows a dated deed on its day, and an edit writes the task
 * kind. A read never writes, so each note keeps its exact bytes.
 */

/** The seed's own notes, exactly as the preview loads them. */
const FIXTURES = sampleSeed([deeds.seed], deeds.seedDay);

/** The seed's URL query, for the first load of a page. */
const query = `vault=${deeds.seed}`;

test.describe("deeds", () => {
  test("Main shows the plain task and no deed", async ({ page }) => {
    await page.goto(`/?${query}`);
    await expect(row(page, deeds.plain)).toBeVisible();

    await expect(row(page, deeds.active)).toHaveCount(0);
    await expect(row(page, deeds.reference)).toHaveCount(0);
  });

  test("a dated deed shows on its day, and its notes are unchanged", async ({
    page,
  }) => {
    await page.goto(`/planner?mode=day&day=${deeds.day}&${query}`);
    await expect(page.getByTestId("day-heading")).toBeVisible();

    await expect(row(page, deeds.active)).toBeVisible();
    await expect(row(page, deeds.reference)).toHaveCount(0);

    // The read leaves both notes byte-identical, and the second read,
    // after a reload, finds them still untouched.
    expect(await noteText(page, deeds.note)).toBe(FIXTURES[deeds.note]);
    expect(await noteText(page, deeds.referenceNote)).toBe(
      FIXTURES[deeds.referenceNote],
    );

    await page.reload();
    await expect(row(page, deeds.active)).toBeVisible();
    expect(await noteText(page, deeds.note)).toBe(FIXTURES[deeds.note]);
  });

  test("an edit of a deed writes the task kind and keeps its properties", async ({
    page,
  }) => {
    await page.goto(`/planner?mode=day&day=${deeds.day}&${query}`);
    const deedRow = row(page, deeds.active);
    await press(page, deedRow.getByRole("button", { name: deeds.active }));

    const editor = page.getByRole("dialog", { name: "Task" });
    await expect(editor).toBeVisible();
    await press(page, editor.getByRole("button", { name: "add repeat" }));
    await press(page, page.getByRole("button", { name: "Weekly" }));

    await expect
      .poll(async () => noteText(page, deeds.note))
      .toContain('kind: "[[tasks]]"');

    const written = (await noteText(page, deeds.note)) as string;
    expect(written).toContain("recurrence: FREQ=WEEKLY");
    expect(written).toContain('status: "[[active]]"');
    expect(written).toContain('parent deed: "[[Garden]]"');
    expect(written).toContain('categories:\n  - "[[digital]]"');
    expect(written).toContain('types:\n  - "[[project]]"');
    expect(written).toContain('after: "[[Order things]]"');
    expect(written).toContain("Water the beds before the heat.");
    expect(written).not.toContain("[[deeds]]");
  });
});
