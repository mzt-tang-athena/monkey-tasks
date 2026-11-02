import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared ways to find things on screen. Specs pass names from
 * `data.ts`; nothing here knows a sample task.
 */

/** A task row by its name: `testID="task-row:<name>"`. */
export function row(page: Page, name: string): Locator {
  return page.getByTestId(`task-row:${name}`);
}

/** A list section header. The header reads its title, two spaces and
    its count, for example "Today  3". */
export function sectionHeader(page: Page, title: string): Locator {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.getByText(new RegExp(`^${escaped}\\s+\\d+$`));
}

/** A list tab by its name. */
export function listTab(page: Page, name: string): Locator {
  return page.getByRole("tab", { name, exact: true });
}

/** The top edge of an element, in page order. */
async function topOf(target: Locator): Promise<number> {
  const box = await target.boundingBox();
  return box == null ? Number.NaN : box.y;
}

/** `upper` sits above `lower` on screen. It waits for the layout to
    settle, so a row that is still moving gets time to land. */
export async function expectAbove(upper: Locator, lower: Locator) {
  await expect
    .poll(async () => (await topOf(upper)) < (await topOf(lower)))
    .toBe(true);
}

/** The row sits in the section under `header`, and above `next` when
    the section has one after it. */
export async function expectInSection(
  target: Locator,
  header: Locator,
  next?: Locator,
) {
  await expectAbove(header, target);
  if (next != null) {
    await expectAbove(target, next);
  }
}
