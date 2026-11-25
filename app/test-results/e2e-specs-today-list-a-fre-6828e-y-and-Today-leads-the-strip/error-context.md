# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/specs/today-list.spec.ts >> a fresh start lands on Today, and Today leads the strip
- Location: e2e/specs/today-list.spec.ts:32:5

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/", waiting until "load"

```

# Test source

```ts
  1   | import type { Page } from "@playwright/test";
  2   | import { expect, test } from "../fixtures";
  3   | import { supplements, supplementsTick, tabs, undated } from "../data";
  4   | import {
  5   |   expectAbove,
  6   |   listTab,
  7   |   openMain,
  8   |   press,
  9   |   row,
  10  |   sectionHeader,
  11  | } from "../locators";
  12  | import { noteText, returnToTab } from "../vault";
  13  | 
  14  | /**
  15  |  * Ticket 20261125-today-list: a built-in Today list leads the tabs, due
  16  |  * today with the past tasks above them, and Settings switches it off.
  17  |  * A tick leaves it, and a capture taken there is due today.
  18  |  */
  19  | 
  20  | /** The sample's overdue task, the first row of the Past group. */
  21  | const past = "Return library books";
  22  | /** A due-today task that is not the repeating one. */
  23  | const dueToday = "Groceries: milk, eggs, oats";
  24  | 
  25  | /** Open Settings from the Lists menu, as a thumb would. */
  26  | async function openSettings(page: Page) {
  27  |   await press(page, page.getByRole("button", { name: "list menu" }));
  28  |   await press(page, page.getByRole("menuitem", { name: "Settings" }));
  29  |   await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  30  | }
  31  | 
  32  | test("a fresh start lands on Today, and Today leads the strip", async ({
  33  |   page,
  34  | }) => {
> 35  |   await page.goto("/");
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  36  |   await expect(row(page, supplements)).toBeVisible();
  37  | 
  38  |   await expect(listTab(page, "Today")).toHaveAttribute("aria-selected", "true");
  39  |   await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "false");
  40  | 
  41  |   const today = await listTab(page, "Today").boundingBox();
  42  |   const main = await listTab(page, tabs.main).boundingBox();
  43  |   expect(today?.x ?? Number.NaN).toBeLessThan(main?.x ?? Number.NaN);
  44  | });
  45  | 
  46  | test("Today holds the due tasks and the past ones, in two groups", async ({
  47  |   page,
  48  | }) => {
  49  |   await page.goto("/");
  50  |   await expect(row(page, supplements)).toBeVisible();
  51  | 
  52  |   const pastHeader = sectionHeader(page, "Past");
  53  |   const todayHeader = sectionHeader(page, "Today");
  54  |   await expect(pastHeader).toBeVisible();
  55  |   await expect(todayHeader).toBeVisible();
  56  | 
  57  |   // The past group sits above the day's own rows.
  58  |   await expectAbove(pastHeader, todayHeader);
  59  |   await expectAbove(pastHeader, row(page, past));
  60  |   await expectAbove(todayHeader, row(page, supplements));
  61  |   await expectAbove(row(page, dueToday), row(page, supplements));
  62  | 
  63  |   // An undated task waits on Main. Today names no day for it.
  64  |   await expect(row(page, undated.second)).toHaveCount(0);
  65  | });
  66  | 
  67  | test("the sort control belongs to the list tabs, not to Today", async ({
  68  |   page,
  69  | }) => {
  70  |   await page.goto("/");
  71  |   await expect(row(page, supplements)).toBeVisible();
  72  |   await expect(page.getByRole("button", { name: "sort list" })).toHaveCount(0);
  73  | 
  74  |   await press(page, listTab(page, tabs.main));
  75  |   await expect(page.getByRole("button", { name: "sort list" })).toBeVisible();
  76  | });
  77  | 
  78  | test("a tick leaves Today and writes its completion", async ({ page }) => {
  79  |   await page.goto("/");
  80  |   await expect(row(page, supplements)).toBeVisible();
  81  | 
  82  |   await press(page, row(page, supplements).getByRole("checkbox"));
  83  | 
  84  |   await expect(row(page, supplements)).toHaveCount(0);
  85  |   await expect.poll(() => noteText(page, supplementsTick.note)).toContain(
  86  |     supplementsTick.completedPrefix,
  87  |   );
  88  | });
  89  | 
  90  | test("a capture on Today is due today", async ({ page }) => {
  91  |   await page.goto("/");
  92  |   await expect(row(page, supplements)).toBeVisible();
  93  | 
  94  |   const name = "Water the ferns";
  95  |   await press(page, page.getByRole("button", { name: "add task" }));
  96  |   await expect(
  97  |     page.getByRole("button", { name: "target list: Today" }),
  98  |   ).toBeVisible();
  99  |   await page.getByPlaceholder("Add a task").fill(name);
  100 |   await press(page, page.getByRole("button", { name: "send task" }));
  101 | 
  102 |   await expect.poll(() => noteText(page, `Tasks/${name}.md`)).toContain(
  103 |     "due: 2026-10-26",
  104 |   );
  105 |   // It writes no list, so the new task belongs to no list note.
  106 |   expect(await noteText(page, `Tasks/${name}.md`)).not.toContain("list:");
  107 |   await expect(row(page, name)).toBeVisible();
  108 | });
  109 | 
  110 | test.describe("Settings", () => {
  111 |   test("switches Today off and on, and the choice survives a reload", async ({
  112 |     page,
  113 |   }) => {
  114 |     await page.goto("/");
  115 |     await expect(row(page, supplements)).toBeVisible();
  116 | 
  117 |     await openSettings(page);
  118 |     const today = page.getByRole("switch", { name: "Today list" });
  119 |     await expect(today).toHaveAttribute("aria-checked", "true");
  120 |     await press(page, today);
  121 |     await expect(today).toHaveAttribute("aria-checked", "false");
  122 | 
  123 |     await page.goBack();
  124 |     await expect(page).toHaveURL("/");
  125 |     // Main leads again, and Today's tab is gone.
  126 |     await expect(listTab(page, "Today")).toHaveCount(0);
  127 |     await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
  128 |     await expect(row(page, undated.second)).toBeVisible();
  129 | 
  130 |     await page.reload();
  131 |     await expect(row(page, undated.second)).toBeVisible();
  132 |     await expect(listTab(page, "Today")).toHaveCount(0);
  133 |     await expect(listTab(page, tabs.main)).toHaveAttribute("aria-selected", "true");
  134 | 
  135 |     // Turn it back on, so the suite's other specs see the shipped
```