import type { Locator, Page } from "@playwright/test";
import { pullDown } from "./gestures";
import { addButton } from "./locators";

/**
 * The command pane, and the one way a finger opens it: a swipe down on
 * the bar's Add button. Every spec takes both from here, so a change to
 * the opener lands in one place.
 */

/** The commands' dialog. */
export function pane(page: Page): Locator {
  return page.getByRole("dialog", { name: "Commands" });
}

/** The pane's search, the field a finger's swipe brings. */
export function search(page: Page): Locator {
  return page.getByPlaceholder("Search commands");
}

/** One command row by its id, such as `command:planner`. */
export function command(page: Page, id: string): Locator {
  return page.getByTestId(`command:${id}`);
}

/**
 * How far a thumb travels down the Add button, in px. The button sits
 * at the window's edge, so this clears the 24 px commit
 * (`motion.addButton` in `src/lib/motion/tokens.ts`) and still ends on
 * screen.
 */
export const swipeDownPx = 30;

/** Swipe the bar's Add button down, as a thumb opens the pane. */
export async function swipeOpen(page: Page): Promise<void> {
  await pullDown(page, "touch", addButton(page), swipeDownPx);
}
