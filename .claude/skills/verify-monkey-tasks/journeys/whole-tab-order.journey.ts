import { expect, test } from "../../../../app/e2e/fixtures";
import { sections, undated } from "../../../../app/e2e/data";
import {
  expectAbove,
  listTab,
  row,
  sectionHeader,
} from "../../../../app/e2e/locators";
import { pointOn, press } from "../../../../app/e2e/gestures";
import { noteText, returnToTab } from "../../../../app/e2e/vault";

/**
 * Ticket 20261111-order-the-whole-tab: in My order a tab is one
 * headerless list, a drop renumbers the whole tab, and Due order keeps
 * its date sections with no drag.
 */

const dentist = "Dentist appointment";
const groceries = "Groceries: milk, eggs, oats";

test("whole-tab order: one flat list, a cross-section drop, and Due untouched", async ({
  page,
}, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: info.outputPath(`${name}.png`) });

  await page.goto("/");
  await expect(row(page, undated.first)).toBeVisible();
  await expect(sectionHeader(page, sections.undated)).toBeVisible();
  await expect(page.getByTestId(/^reorder-grip:/)).toHaveCount(0);
  await shot("01-due-order-sections");

  const dueTop = await row(page, undated.first).evaluate((element) => {
    const list = element.closest('[data-testid="list-pager"]');
    return list == null
      ? 0
      : element.getBoundingClientRect().top - list.getBoundingClientRect().top;
  });

  await page.getByRole("button", { name: "sort list" }).click();
  await page.getByRole("radio", { name: "My order Drag rows to sort" }).click();
  await expectAbove(row(page, undated.first), row(page, undated.second));

  // No date header survives in My order: the group is headerless.
  await expect(sectionHeader(page, sections.undated)).toHaveCount(0);
  await expect(sectionHeader(page, sections.today)).toHaveCount(0);
  await expectAbove(row(page, undated.second), row(page, dentist));
  await expectAbove(row(page, dentist), row(page, groceries));
  await shot("02-my-order-flat");

  const flatTop = await row(page, undated.first).evaluate((element) => {
    const list = element.closest('[data-testid="list-pager"]');
    return list == null
      ? 0
      : element.getBoundingClientRect().top - list.getBoundingClientRect().top;
  });
  await info.attach("first-row-top", {
    body: `Due order ${dueTop}px, My order ${flatTop}px below the pager top.`,
    contentType: "text/plain",
  });

  // A real grip drag across where the Tomorrow section used to start.
  await row(page, undated.first).scrollIntoViewIfNeeded();
  const height = (await row(page, undated.first).boundingBox())?.height ?? 0;
  const target = await pointOn(page, row(page, undated.first), "upper");
  const pointer = await press(
    page,
    "mouse",
    page.getByTestId(`reorder-grip:${dentist}`),
    { holdMs: 0 },
  );
  await pointer.moveTo(target);
  await expect
    .poll(() =>
      page
        .getByTestId(`reorder-item:${dentist}`)
        .evaluate((element) => {
          const value = getComputedStyle(element).transform;
          return value === "none" ? 0 : new DOMMatrixReadOnly(value).f;
        }),
    )
    .toBeLessThan(-Math.max(1, height / 2));
  await pointer.up();

  await expectAbove(row(page, dentist), row(page, undated.first));
  await shot("03-after-cross-section-drop");

  await expect
    .poll(() => noteText(page, `Tasks/${dentist}.md`))
    .toContain("order: 1");
  await expect
    .poll(() => noteText(page, `Tasks/${undated.first}.md`))
    .toContain("order: 2");
  await expect
    .poll(() => noteText(page, `Tasks/${undated.second}.md`))
    .toContain("order: 3");

  await returnToTab(page);
  await expectAbove(row(page, dentist), row(page, undated.first));
  await row(page, dentist).scrollIntoViewIfNeeded();
  await shot("04-after-vault-reread");

  // The Completed group keeps its header and its place below the flat
  // open rows.
  await row(page, "Water the plants").scrollIntoViewIfNeeded();
  await expect(sectionHeader(page, sections.completed)).toBeVisible();
  await shot("05-my-order-completed");

  // A list tab in My order is the same flat list.
  await listTab(page, "Focus").click();
  await expect(page.getByTestId(/^reorder-grip:/).first()).toBeVisible();
  await expect(sectionHeader(page, sections.undated)).toHaveCount(0);
  await shot("06-my-order-list-tab");
  await listTab(page, "Main").click();
  await expect(row(page, undated.first)).toBeVisible();

  // Due order still groups by date, and a drag still does not start.
  await page.getByRole("button", { name: "sort list" }).click();
  await page.getByRole("radio", { name: "Due date Soonest first" }).click();
  await expect(sectionHeader(page, sections.undated)).toBeVisible();
  await expect(sectionHeader(page, sections.today)).toBeVisible();
  await expect(page.getByTestId(/^reorder-grip:/)).toHaveCount(0);
  await shot("07-due-order-restored");
});
