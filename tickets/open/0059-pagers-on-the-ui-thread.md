---
id: 0059
title: The three pagers run on the UI thread
created: 2026-10-26
priority: high
assignee:
pr:
depends: [0058]
---

## Spec

Epic 0047, phase 4. ADR 0036 and its amendment to ADR 0033 decide
this. Ticket 0058 built `usePager` in `src/lib/motion`. This ticket
moves the list tabs, the planner day body and the month calendar onto
it, and deletes the old pager.

### What breaks today

Line numbers point at today's files. The fix lands in the phase 3
homes: the lists screen in `src/features/lists`, the day components in
`src/features/planner/day`, and the month view in `src/features/planner`.

| Bug | Today | What the user sees |
|---|---|---|
| V1 | `components/SwipePager.tsx:88-101`: `back()` drops the neighbour before the 180 ms return starts. | A short drag returns over a blank strip. |
| V2 | `SwipePager.tsx:121,138-157`. A new drag calls `setValue`, which stops the running settle (`react-native/Libraries/Animated/nodes/AnimatedValue.js:143-145`). The callback then gets `finished: false`, and `onPage` never runs. | Two fast flicks move one page, and the first snaps back. |
| V3 | `SwipePager.tsx:177-201`, with `app/(tabs)/index.tsx:725-732`, `features/planner/components/DaySpread.tsx:138-146` and `MonthView.tsx:56-64`. The cell kept for 250 ms (`153-157`) renders from the new page, so it shows page N+2. The reset in the layout effect (`165-168`) is a native animated call apart from the Fabric commit. | A frame of the wrong page can flash at the commit. The day and month flicker from the 0046 phone pass. |
| V4 | `features/lists/ListPagePreview.tsx:67-104` and `features/planner/components/DayPreview.tsx:78` draw from the top. The live scroller (`index.tsx:734`, `DaySpread.tsx:610`) keeps its old offset. | The landed page jumps. This is the list's vertical shift from the 0046 phone pass. |
| V5 | `DayPreview.tsx:47-51,81` uses the exact date filter and `isToday={false}`. The live day (`DaySpread.tsx:358-370,709`) uses `tasksForDayAll`, and today adds the overdue block and the now line. | Rows pop in when a swipe lands on a day with a recurring task, or on today. |
| J1 | `SwipePager.tsx:79-86,105-117` sets screen state at swipe start, and the ref lags a render. `ListPagePreview.tsx:70-101` renders every row. The day preview mounts live rows with hooks (`TaskListSection.tsx:78-85`). | The first frames of a swipe stall on a long list. |
| V12 | `lib/swipe.ts:143-160` has no pointer capture. `pointercancel` and native `terminate` (`swipe.ts:127`) count as a release and can commit. | In the browser, a release outside the body leaves the page offset. A cancelled touch can change the page. |
| L1 | `index.tsx:115` scrolls the tab strip with `animated: true` always. | The strip slides with reduce motion on. |
| B1 | Ticket 0049 found it, and 0055 guards it with a press guard in `src/hooks/use-press-guard.ts`. The pager (`index.tsx:820-824`, `swipe.ts:139-164`) never swallows the click that ends a mouse swipe on a row. | A mouse swipe that starts on a row also opens the task editor. |
| B2 | Ticket 0049 found it. The swipe body keeps `touch-action: auto`, so Chrome claims the pan and sends `pointercancel`. | A touch swipe never turns the page in a mobile browser. |

### The new pager

Add `src/components/pager.tsx` on `usePager`. Its props are `index`,
`pageKey`, `canGo`, `onPage`, `renderPreview(index)`, `fill` and the
live page as `children`.

- The track is one `Animated.View` with the hook's `trackStyle`. The
  live cell sits in the flow at `left = index * width`, so the live
  page alone sets the height, as ADR 0033 requires. A preview cell
  sits out of the flow at `left = i * width`, one for each position
  that `onVisible` reports.
- The live cell's key is `pageKey`. A commit mounts the new page at
  its top, the same as the preview that slid in.
- `renderPreview` takes a track position and never reads the live
  page. The cell beside a landed page shows that position's page,
  never the one after it.
- Pages use small indices: the tab's position, days from the day the
  screen mounted, months from the month the screen mounted.
- A tab tap and a date strip tap call `goTo`, so they slide like a
  swipe.
- No `claim()`. Each row drag, grip and grabber is its own gesture.
  The orchestrator gives the touch to the first gesture that
  activates. A row's hold activates before the pager's 12 px offset,
  so a hold and a sideways drag lift the row.
- Press targets inside a page use gesture handler's `Pressable`
  (0058). The pan's activation cancels the press, so a swipe that
  starts on a row opens nothing. Remove the swipe arm of
  `use-press-guard` that 0055 added.
- A scroller inside a page renders through gesture handler's
  `ScrollView`. For a `SectionList`, pass it as `renderScrollComponent`.
  The pan and the scroll then compete in one orchestrator on Android,
  iOS and the web. In the browser, `touchAction: 'pan-y'` on the pan
  leaves vertical scrolling to the browser, because a native gesture
  cannot block a browser scroll.
- With reduce motion on, the page does not follow the finger, and a
  release past the threshold changes the page at once (ticket 0030).

### The previews

- The list preview renders only the rows that fit the viewport
  height, with plain `PreviewRow`s.
- The day preview renders through the same `lib/day-rows` function as
  the live day (0056), with the real `isToday`, the overdue block and
  the now line. It mounts still rows, never live `TaskRow`s.
- The month preview stays the still `MonthGrid`.

### Remove

Delete `SwipePager`, `lib/swipe.ts` and `lib/swipe.test.ts`. The
`pager-math` tests from 0058 replace the swipe tests. Remove this
ticket's files from the 0058 lint allowlist.

### Tests first

Each bug gets a failing test before its fix. The Playwright suite in
`app/e2e` (0049) runs each scenario twice: with the mouse, and with
CDP touch through the swipe helper in `app/e2e/gestures.ts`, in a
context with `hasTouch: true`. The scenarios target the test ids from
0049: `list-pager`, `day-pager`, `day-heading`, `month-pager` and
`month-title`. Ticket 0049 already holds two tests with `test.fail()`
in `lists.spec.ts`, for B1 and B2. This ticket removes both marks.

| Scenario | Proves |
|---|---|
| A 40 px drag on `list-pager`, then release: the preview cell stays in the DOM until the track rests. | V1 |
| Two 120 px drags 100 ms apart: the tab moves two places. | V2 |
| After a commit, no cell holds the page two places away. | V3 content |
| Scroll Main to its middle, drag 95 percent of the width and hold, take a screenshot, release, take another. The two match. | V4, 0046 shift |
| The same screenshot pair for a day with a recurring task, and for a swipe onto today. | V5 |
| A mouse drag of 100 px, then release over the bottom bar: the track rests. | V12 |
| A touch drag of 120 px that ends in `touchCancel`: the tab stays. | V12 |
| A vertical touch drag of 300 px with 30 px sideways drift: the list scrolls, the tab stays, no preview mounts. | `pan-y` |
| A 200 px drag right on the first list: the travel stays at 48 px or less and returns. | rubber band |
| `page.emulateMedia({ reducedMotion: 'reduce' })`, then a 120 px drag: the track never moves, and the tab changes on release. A tab tap changes the page with no travel. | reduce motion, L1 |

A jsdom component test covers J1. It counts renders and asserts that a
swipe start renders the lists screen at most once. For a list of 300
tasks, the preview renders no more rows than fit the viewport.

The browser cannot show the frame flash in V3 or the 0046 flicker,
because web `Animated` has no native thread. Only the phone shows
those.

## Acceptance

- [ ] Each scenario above has a failing Playwright or component test
      before its fix, and all pass after, with the mouse and with
      touch.
- [ ] The B1 and B2 tests in `app/e2e/lists.spec.ts` pass without
      `test.fail()`, and the swipe arm of `use-press-guard` is gone.
- [ ] The list, the day and the month page through `pager.tsx`, and
      `SwipePager` and `lib/swipe.ts` are gone.
- [ ] Lint passes with this ticket's files out of the allowlist.
- [ ] Phone, reduce motion off: on the list, the day and the month, a
      slow drag, a flick, a short drag, a double flick and a swipe at
      each end show no blank strip, no flash at the commit and no
      vertical shift on landing.
- [ ] Phone: a vertical scroll with sideways drift never pages, a
      swipe on the chip strip scrolls the strip, and a row hold then a
      sideways drag lifts the row.
- [ ] Phone: the system back gesture from the screen edge never
      changes the page.
- [ ] Phone, reduce motion on: the page does not travel, a release
      past the threshold changes the page, and a tab tap changes it at
      once.
- [ ] The phone pass that ticket 0046 left open passes here: the list
      lands with no vertical shift, and the day and the month land with
      no flicker.

## Outcome
(filled in before moving to done/)
