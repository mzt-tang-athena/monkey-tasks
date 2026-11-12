import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { capture, overdue } from "../data";
import { press, type Input } from "../gestures";
import { row } from "../locators";
import { notePaths, noteText } from "../vault";

/**
 * Ticket 0078: a press runs even when its row mounts or re-renders under
 * the finger, and a pan that starts on the row still cancels it.
 */

const overdueNote = "Tasks/Return library books.md";

/** The tick target of a live row. */
function tick(page: Page, name: string) {
  return row(page, name).getByRole("checkbox");
}

test("a tap in the first layout frame of a row ticks it", async ({
  page,
  reducedMotion,
}) => {
  test.skip(reducedMotion === "reduce", "one project is enough");
  await page.goto("/");
  await expect(row(page, "Call Mum")).toBeVisible();

  // The new row's tick gets a whole tap in the same task as its mount:
  // down, up and the click the browser makes, before React has reported
  // the row's layout. A press that reads the layout report drops it.
  await page.evaluate((name) => {
    const seen = window as unknown as { firstTap: string };
    seen.firstTap = "waiting";
    const id = `task-row:${name}`;
    const observer = new MutationObserver(() => {
      const added = document.querySelector(`[data-testid="${id}"]`);
      const button = added?.querySelector(
        '[role="checkbox"]',
      );
      if (button == null) {
        return;
      }
      observer.disconnect();
      const box = button.getBoundingClientRect();
      const at = {
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
        view: window,
      };
      button.dispatchEvent(new PointerEvent("pointerdown", at));
      button.dispatchEvent(new PointerEvent("pointerup", { ...at, buttons: 0 }));
      button.dispatchEvent(
        new MouseEvent("click", { ...at, buttons: 0, detail: 1 }),
      );
      seen.firstTap = `${box.width}x${box.height}`;
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }, capture.name);

  await page.getByRole("button", { name: "add task" }).click();
  await page.getByPlaceholder("Add a task").fill(capture.typed);
  await page.getByRole("button", { name: "send task" }).click();

  await expect(row(page, capture.name)).toBeVisible();
  await expect
    .poll(() => notePaths(page, "Tasks/"))
    .toContain(`Tasks/${capture.name}.md`);
  const seen = await page.evaluate(
    () => (window as unknown as { firstTap: string }).firstTap,
  );
  expect(seen, "the tap ran in the mount's task").not.toBe("waiting");
  await expect
    .poll(() => noteText(page, `Tasks/${capture.name}.md`))
    .toContain("completed: 2026-10-26T");
});

const inputs: Input[] = ["mouse", "touch"];

for (const input of inputs) {
  test(`a held tick released in place does not tick, ${input}`, async ({
    page,
  }) => {
    await page.goto("/planner");
    await expect(page.getByTestId("day-heading")).toBeVisible();
    const before = await noteText(page, overdueNote);
    expect(before, "the row starts open").not.toContain("completed");

    await press(page, input, tick(page, overdue.name), {
      holdMs: 400,
    }).then((pointer) => pointer.up());
    await page.waitForTimeout(300);

    expect(
      await noteText(page, overdueNote),
      "the pan cancelled the tick",
    ).toBe(before);
  });
}
