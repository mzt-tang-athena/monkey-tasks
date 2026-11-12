import { expect, test } from "../fixtures";
import { tabs, undated } from "../data";
import { listTab, row, tabTo } from "../locators";
import { rgb, setTheme } from "../theme";
import { THEMES, type ThemeName } from "../../src/theme/palettes";

/**
 * Ticket 20261112-control-focus-ring: a keyboard user sees where focus
 * is. Every press target draws the shared mark on a keyboard focus and
 * drops it on a pointer press, in every palette.
 */

const palettes = Object.keys(THEMES) as ThemeName[];

test.describe("the focus ring", () => {
  for (const palette of palettes) {
    test(`${palette}: a tab draws the mark and a click drops it`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 412, height: 915 });
      await page.goto("/");
      await setTheme(page, palette);
      await expect(row(page, undated.second)).toBeVisible();

      const main = listTab(page, tabs.main);
      await tabTo(page, main);
      await expect(main).toBeFocused();
      await expect(main).toHaveCSS("outline-style", "solid");
      await expect(main).toHaveCSS("outline-width", "2px");
      await expect(main).toHaveCSS(
        "outline-color",
        rgb(THEMES[palette].focusRing),
      );

      // A real click on the same control. It holds focus and changes
      // nothing, so only the pointer's own verdict can drop the mark.
      await main.hover();
      await page.mouse.down();
      await expect(main).toHaveCSS("outline-style", "none");
      await page.mouse.up();
      await expect(main).toBeFocused();
      await expect(main).toHaveCSS("outline-style", "none");

      // A tab moves the mark to the next control: another tab, the sort
      // button, then a task row, which is the largest press target.
      const next = listTab(page, tabs.next);
      await tabTo(page, next);
      await expect(next).toHaveCSS(
        "outline-color",
        rgb(THEMES[palette].focusRing),
      );

      const sort = page.getByRole("button", { name: "sort list" });
      await tabTo(page, sort);
      await expect(sort).toHaveCSS(
        "outline-color",
        rgb(THEMES[palette].focusRing),
      );

      const body = row(page, undated.second).getByRole("button");
      await tabTo(page, body);
      await expect(body).toBeFocused();
      await expect(body).toHaveCSS("outline-style", "solid");
      await expect(body).toHaveCSS(
        "outline-color",
        rgb(THEMES[palette].focusRing),
      );
    });
  }
});
