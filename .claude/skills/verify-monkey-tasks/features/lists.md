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

- **Switch list.** `listTab(page, tabs.next).click()`, or `swipe(page, sectionHeader(page, sections.today), "left", "page")`. The `Errands` tab is selected and the page reads "Nothing on this list yet."
- **Tick.** `row(page, <name>).getByRole("button", { name: "mark done" }).click()`. The row moves under the `Completed` header (`expectInSection`), and its note gains `completed:`.
- **Sort.** Open the sort button in the header, pick an order in the sheet. The sheet marks the order in use, and the rows reorder.
- **Reorder.** In My order, `holdDrag(page, row(page, undated.second), row(page, undated.first))`, or drag `reorder-grip:<name>`. The moved row stays in place after `returnToTab`.
- **Proof.** Screenshot before and after each action. For a tick or reorder, attach `noteText` of the changed note.

## Driving it on Android

Native-only check. Run it after `scripts/android-launch.sh <apk>`:

```sh
.claude/skills/verify-monkey-tasks/journeys/android-list-swipe.sh
```

- **Switch list, motion on and off.** It reads the `~TODAY` header's center, then swipes 600 px left in 300 ms inside `frames`. `Nothing on this list yet.` must show. With motion on, `swipe-motion-on-frames/sheet.png` shows Main sliding out and Errands sliding in over several frames. With `motion off` the grid jumps from Main to Errands with no frame between.
- **Tick.** It taps `task-row:Plan weekend hike>>mark done`, records it to `tick.mp4`, scrolls to the row under Completed and reads the note. `note-ticked.md` must hold `completed:`.
- **Untick round trip.** It taps `mark not done`, scrolls back up, and compares `note-unticked.md` with `note-before.md` byte for byte.
- **Proof.** The run folder holds the shots, both grids, the notes and `app.log`.

## Gotchas

- The sample set has two broken notes (`Garden.md`, `Broken note.md`). The `Needs repair` banner at the top of Main is expected and sticks over the list while it scrolls.
- Rows wash in on mount. A screenshot right after `goto` can catch them mid-fade. Wait for a row to be visible first.
- Start a mouse swipe on a section header, never on a row. A swipe that starts on a row also opens the editor in the `motion` project today. That is bug B1, marked `test.fail` in `app/e2e/specs/lists.spec.ts` until ticket 0059. It is a known bug, not a regression.
- A touch swipe (`touchSwipe`) does not turn the page in Chromium today. That is bug B2, marked `test.fail` in the suite until ticket 0059.
- On Android the untick round trip fails today. The note keeps the tail of the ticked text (ticket 0076). The journey reports it and prints the diff. Until 0076 lands, the swipe and the tick steps still prove what they cover.
- On Android, Errands slides in with only the repair banner. `Nothing on this list yet.` shows once the page settles.
