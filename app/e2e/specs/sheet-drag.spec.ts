import { expect, test } from "../fixtures";
import { undated } from "../data";
import { pullDown, sheetPx, type Input } from "../gestures";
import { press, row } from "../locators";
import type { Locator, Page } from "@playwright/test";

const editor = (page: Page) => page.getByRole("dialog", { name: "Task" });

/** A pull measures its start once, so the panel must stand still. */
async function opened(dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
}

async function openEditor(page: Page) {
  await page.goto("/");
  await press(page, row(page, undated.second).getByRole("button", { name: undated.second }));
  await opened(editor(page));
}

/** The panel's top edge, once it holds still. */
async function restingTop(page: Page, name: string) {
  const dialog = page.getByRole("dialog", { name });
  let top = Number.NaN;
  await expect(async () => {
    const first = (await dialog.boundingBox())?.y;
    await page.waitForTimeout(100);
    const second = (await dialog.boundingBox())?.y;
    expect(first).toBeDefined();
    expect(second).toBe(first);
    top = second ?? Number.NaN;
  }).toPass();
  return top;
}

for (const input of ["touch", "mouse"] as const satisfies readonly Input[]) {
  test.describe(`a ${input} drag on a sheet`, () => {
    test.use(input === "touch" ? { hasTouch: true, isMobile: true } : {});

    test("closes the editor from its header and opens no picker", async ({ page }) => {
      await openEditor(page);
      const header = editor(page).getByRole("button", { name: /^change list/ });

      await pullDown(page, input, header, sheetPx.close);

      await expect(editor(page)).toHaveCount(0);
      // The drag's own click never reaches the list control.
      await expect(page.getByRole("dialog", { name: "List" })).toHaveCount(0);
    });

    test("closes the editor from its handle", async ({ page }) => {
      await openEditor(page);

      await pullDown(page, input, editor(page).getByTestId("sheet-handle"), sheetPx.close);

      await expect(editor(page)).toHaveCount(0);
    });

    test("springs back from a short drag", async ({ page }) => {
      await openEditor(page);
      const rest = await restingTop(page, "Task");

      await pullDown(page, input, editor(page).getByTestId("sheet-handle"), sheetPx.short);

      await expect(editor(page)).toBeVisible();
      expect(await restingTop(page, "Task")).toBeCloseTo(rest, 0);
    });

    test("closes only the picker stacked over the editor", async ({ page }) => {
      await openEditor(page);
      await editor(page).getByRole("button", { name: "add due date" }).click();
      const due = page.getByRole("dialog", { name: "Due" });
      await opened(due);

      await pullDown(page, input, due.getByText("Due", { exact: true }), sheetPx.close);

      await expect(due).toHaveCount(0);
      await expect(editor(page)).toBeVisible();
    });

    test("closes the capture sheet from its handle", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "add task" }).click();
      const capture = page.getByRole("dialog", { name: "Add a task" });
      await opened(capture);

      await pullDown(page, input, capture.getByTestId("sheet-handle"), sheetPx.close);

      await expect(capture).toHaveCount(0);
    });
  });
}

test("a tap on the editor's header still presses its control", async ({ page }) => {
  await openEditor(page);

  await editor(page).getByRole("button", { name: /^change list/ }).click();

  await expect(page.getByRole("dialog", { name: "List" })).toBeVisible();
});
