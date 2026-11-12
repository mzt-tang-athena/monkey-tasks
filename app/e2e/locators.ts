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

/**
 * `first` comes before `second` in the document. A grouped row's place
 * is its section's order, not the pixels it happens to carry while the
 * list scrolls.
 */
export async function expectBefore(first: Locator, second: Locator) {
  await expect
    .poll(async () => {
      const one = await first.elementHandle();
      const two = await second.elementHandle();
      if (one == null || two == null) {
        return false;
      }
      return one.evaluate(
        (element, other) =>
          (element.compareDocumentPosition(other) &
            Node.DOCUMENT_POSITION_FOLLOWING) !==
          0,
        two,
      );
    })
    .toBe(true);
}

/**
 * Press an element. Playwright scrolls it into view and waits for it to
 * hold still. React Native's press takes the browser's click, so it
 * needs no layout report and no frame wait (ADR 0046).
 */
export async function press(page: Page, target: Locator) {
  await target.click();
}

/**
 * Press Tab until the control holds focus. A browser holds focus on one
 * control, so a keyboard walk is the only way to see a real focus ring,
 * and it keeps the input modality the browser reports.
 */
export async function tabTo(page: Page, target: Locator, limit = 40) {
  for (let step = 0; step < limit; step++) {
    await page.keyboard.press("Tab");
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
  }
  throw new Error("the tab walk never reached the control");
}
