# Lists

The Lists tab shows one list per page. Main is first, then each list
note by name. A page groups tasks into dated sections (Past, Today,
Tomorrow, each later day), No date and Completed. A user ticks a task,
swipes between lists, picks a sort and reorders rows by hand.

## Sub-features

- `lists-tabs` switches lists from the tab strip or by a swipe on the page.
- `lists-sections` groups and counts tasks by date.
- `lists-tick` marks a task done and moves it to Completed, and unticks it.
- `lists-sort` picks the order from the sort sheet.
- `lists-reorder` moves a row by a hold or by its grip in My order.

## How to get to it (user POV)

- Open the app. Lists is the start screen at `/`.
- Tap `Lists` in the bottom bar from any other screen.
- Tap a tab name, or swipe the page left or right.

## Driving it with Playwright

Preconditions: a fresh page on `/`, and `row(page, undated.second)` is visible.

- **Switch list.** `listTab(page, tabs.next).click()`, or `swipe(page, <page body>, "left", "page")`. The `Errands` tab is selected and the page reads "Nothing on this list yet."
- **Tick.** `row(page, <name>).getByRole("button", { name: "mark done" }).click()`. The row moves under the `Completed` header (`expectInSection`), and its note gains `completed:`.
- **Sort.** Open the sort button in the header, pick an order in the sheet. The sheet marks the order in use, and the rows reorder.
- **Reorder.** In My order, `holdDrag(page, row(page, undated.second), row(page, undated.first))`, or drag `reorder-grip:<name>`. The moved row stays in place after `returnToTab`.
- **Proof.** Screenshot before and after each action. For a tick or reorder, attach `noteText` of the changed note.

## Gotchas

- The sample set has two broken notes (`Garden.md`, `Broken note.md`). The `Needs repair` banner at the top of Main is expected and sticks over the list while it scrolls.
- Rows wash in on mount. A screenshot right after `goto` can catch them mid-fade. Wait for a row to be visible first.
- A mouse swipe that starts on a row must not open the editor (bug B1). Assert the URL stays `/`.
- A touch swipe (`touchSwipe`) does not turn the page in Chromium today. That is bug B2, marked `test.fail` in the suite until ticket 0059.
