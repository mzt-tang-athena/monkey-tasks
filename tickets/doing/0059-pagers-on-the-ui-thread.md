---
id: 0059
title: The three pagers run on the UI thread
created: 2026-10-26
priority: high
assignee: omp
pr:
depends: [0058]
---

## Spec

Epic 0047, phase 4. ADR 0036, its amendment to ADR 0033, and ADR 0046
decide this. Ticket 0058 built `Pager` in
`src/components/motion/pager.tsx`. This ticket moves the list tabs, the
planner day body and the month calendar onto it, and deletes the old
pager. Paths are on `epic/0047-rebuild` at commit `745976f`, under
`app/src`.

### Design, 2026-11-08

This spec follows the 2026-11-08 design package for phase 4. ADR 0046
records it. What matters here:

- The screen writes no gesture code. It renders `Pager` with an
  `index`, `bounds`, `onPage` and `renderPreview`. The surface owns the
  pan, `touchAction`, the settle, the previews and reduce motion.
- There is no `pageKey`, `canGo`, `goTo` or `claim()`. A tab tap or a
  strip tap sets a new `index`. One page away slides, and more than one
  cuts.
- The prototype showed that gesture handler's web `Pressable` cancels
  when a parent pan activates, with the mouse and with CDP touch, 10
  runs in 10. React Native's `Pressable` does not. So the press guard's
  swipe arm can go.
- Gesture handler 3.3.0 drops the detector's `touchAction` prop on the
  web. `Pager` passes `pan-y` in the gesture config, and a test reads
  the computed value.

### What breaks today

| Bug | Today | What the user sees |
|---|---|---|
| V1 | `components/swipe-pager.tsx:100-113`. `back()` drops the neighbour before the 180 ms return starts. | A short drag returns over a blank strip. |
| V2 | `swipe-pager.tsx:101,135,157-160,180` and `lib/swipe.ts:64-68`. A new drag calls `setValue`, which stops the running settle with `finished: false`, so `onPage` never runs. | Two fast flicks move one page, and the first snaps back. |
| V3 | `swipe-pager.tsx:161-171,178-182,188-208`, with `features/planner/hooks/use-planner-route.ts:45-48`. The kept cell renders from the new page, so it shows page N+2. The layout effect resets the offset apart from the commit, and day and month commit through an async `router.setParams`. | A frame of the wrong page can flash at the commit. The day and month flicker from the phone pass of ticket 0046. |
| V4 | `features/lists/components/list-page-preview.tsx:28-54` and `features/planner/components/day/day-preview.tsx:36-47` draw from the top. The live cell has no key (`swipe-pager.tsx:200`), so it keeps its old scroll offset. | The landed page jumps. This is the list's vertical shift from the phone pass of ticket 0046. |
| V5 | 0056 fixed the rows: the preview and the live day both call `dayRows`. One part is left: each page reads its own `now` (`day/day-page.tsx:37-38`). | Rows pop in when a swipe lands on a day with a recurring task, or on today. The rows are fixed. The now line can still jump. |
| J1 | `swipe-pager.tsx:123-131` sets screen state at swipe start. `list-page-preview.tsx:26-54` renders every row. The day preview mounts live rows with hooks (`task-list-section.tsx:73`, `day/overdue-group.tsx:38`). | The first frames of a swipe stall on a long list. |
| V12 | `lib/swipe.ts:141,157-174` and `day/day-spread.tsx:133-155`. No pointer capture. `pointercancel` and native `terminate` count as a release and can commit. | In the browser, a release outside the body leaves the page offset. A cancelled touch can change the page. |
| L1 | `components/ui/tab-strip.tsx:75` scrolls the strip with `animated: true` always. | The strip slides with reduce motion on. |
| B1 | 0055's press guard fixed the lists, with two gaps. A mouse swipe released outside `list-pager` leaves the guard armed (review note below). Month cells have no guard (`month-grid.tsx:139`). | A mouse swipe that starts on a row also opens the task editor. |
| B2 | No `touch-action` on `lists-screen.tsx:245-249`, `day/day-spread.tsx:127-161` or `month-view.tsx:75`. Chrome claims the pan and sends `pointercancel`. `e2e/specs/lists.spec.ts:61` still holds `test.fail()`. | A touch swipe never turns the page in a mobile browser. |

### What `Pager` makes impossible, and what stays here

By construction, once all three screens render `Pager`:

- V1. A preview cell exists while its page is on screen, and nothing
  drops it on a timer.
- V2. A touch during a settle commits the pending page and rebases.
- V3. Cells sit at their page's place. A commit changes props only, and
  a preview renders its own page.
- V12. Gesture handler captures the pointer. Only an uncancelled end
  commits.
- B1. No guard exists. Every press target is gesture handler's
  `Pressable`, and lint bans React Native's.
- B2. `Pager` sets `pan-y` in its gesture config.
- V4 and J1, the surface half. The live cell keys on `index`, so a
  landed page mounts at its top. The visible set is `Pager` state, so
  the screen does not render at swipe start.

This ticket still owns:

- V4, the feature half. Each preview draws from the top.
- V5. The day preview and the live day share one `now`.
- J1, the feature half. The list preview renders one screenful.
- L1. The tab strip reads Reanimated's `useReducedMotion` and scrolls
  with `animated: !reduced`.

### The change

- The lists screen (`features/lists/lists-screen.tsx`), the day
  (`features/planner/components/day/day-spread.tsx`) and the month
  (`features/planner/components/month-view.tsx`) render
  `<Pager testID=... index bounds onPage renderPreview fill>`.
- The list index is the tab's position, with
  `bounds={{ first: 0, last: tabs.length - 1 }}`. The day index counts
  days from the day the screen mounted. The month index counts months
  from the month the screen mounted. Day and month pass no bounds.
- The day pager's host moves from the whole day root to the day body.
  The heading, the timeline and the task list slide. The date strip and
  the mode switch stay still (ADR 0033).
- A tab tap (`lists-toolbar.tsx`) and a date strip tap
  (`period-strip.tsx`) set the index through the screen's state.
- A scroller inside a page passes
  `renderScrollComponent={renderMotionScroll}`, or renders
  `MotionScrollView`.
- Press targets inside a page use gesture handler's `Pressable`. That
  covers `month-grid.tsx`, `month-pane.tsx`, `period-strip.tsx`,
  `list-notices.tsx` and `tab-strip.tsx`. 0058 swapped the shared
  buttons.
- Remove the swipe arm of `src/hooks/use-press-guard.ts`. The reorder
  drop still arms it until 0060.
- Today the `list-pager` host also carries the reorder's web moves and
  ups (`swipeProps(controller, { move: moveRow, up: endRow })` in
  `lists-screen.tsx`). Move those two handlers onto a plain `View`
  inside the page, and keep that file on the allowlist for 0060. If you
  drop them, web reorder breaks.
- The day root also carries the split's web resize. `split-handle.tsx`
  starts it with `split.begin`, and the root's `onPointerMove`,
  `onPointerUp` and `onPointerCancel` call `split.move(pageY)` and
  `split.end()` (`day/day-spread.tsx:143-154`, the web path of
  `hooks/use-split-pane.ts`). The root's `useTouchDragGate` call holds
  the touch for the grabber. When the pager host moves to the body,
  keep those calls and the gate on the day root, a plain `View`. Drop
  only the swipe calls, and keep `day-spread.tsx` on the allowlist for
  0061, whose `Split` replaces them. If you drop them, the web grabber
  stops resizing.

### The previews

- The list preview renders only the rows that fit the viewport height,
  with plain `PreviewRow`s, from the top.
- The day preview calls `dayRows` (`features/planner/lib/day-rows.ts`)
  with the real `isToday`, the overdue block and the now line. It reads
  the same `now` as the live day, from one place in `day-spread.tsx`.
  It mounts still rows, never live `TaskRow`s, `TaskListSection` or
  `OverdueGroup`. It keeps today's split drawing until 0061 gives it
  `SplitStill`.
- The month preview stays the still `MonthGrid`.

### Remove

Delete `src/components/swipe-pager.tsx`, `src/lib/swipe.ts` and
`src/lib/swipe.test.ts`. The `pager-math` tests from 0058 replace the
swipe tests. Remove this ticket's files from the 0058 lint allowlist,
except `lists-screen.tsx` and `day/day-spread.tsx`, which stay for 0060
and 0061.
Update the comment in `e2e/specs/motion.spec.ts` that points at
`swipe-pager.tsx`.

### Tests first

Each bug gets a failing test before its fix. The Playwright suite in
`app/e2e` runs each scenario twice: with the mouse, and with CDP touch
in a context with `hasTouch: true`. The scenarios target the test ids
`list-pager`, `day-pager`, `day-heading`, `month-pager` and
`month-title`.

- Add `touchCancel` to `app/e2e/gestures.ts`. It starts a CDP touch,
  moves it, and ends with `Input.dispatchTouchEvent` type
  `touchCancel`.
- A slide runs on Reanimated's frame loop. With a paused clock,
  `page.clock.runFor` steps it. The prototype showed that, 10 runs in
  10.
- Reduce motion scenarios run in the `reduced-motion` project, which
  sets the flag before load. Never call `page.emulateMedia` after load.
  Reanimated reads the flag once.
- 0055 already removed the B1 mark. The B2 mark at
  `e2e/specs/lists.spec.ts:61` goes in this ticket.

| Scenario | Proves |
|---|---|
| `expectTouchAction` reads `pan-y` on `list-pager`, `day-pager` and `month-pager`. | B2, the `touchAction` bug |
| A touch swipe on the list turns the page. | B2 |
| A mouse swipe and a touch swipe that start on a row open no editor. The same on a month cell opens no day. | B1, the `Pressable` cancel |
| A mouse swipe released over the bottom bar, then a tap on a row. The track rests, and the tap opens the row. | B1, the review note, V12 |
| A 40 px drag on `list-pager`, then release. The preview cell stays in the DOM until the track rests. | V1 |
| Two 120 px drags 100 ms apart. The tab moves two places. | V2 |
| After a commit, no cell holds the page two places away. | V3 content |
| Scroll Main to its middle, drag 95 percent of the width and hold, take a screenshot, release, take another. The two match. | V4, the ticket 0046 shift |
| The same screenshot pair for a day with a recurring task, and for a swipe onto today. | V5 |
| A touch drag of 120 px that ends in `touchCancel`. The tab stays. | V12 |
| A vertical touch drag of 300 px with 30 px sideways drift. The list scrolls, the tab stays, and no preview mounts. | `pan-y` |
| A 200 px drag right on the first list. The travel stays at 48 px or less, and the track returns. | rubber band |
| A tab tap one place away slides. A tab tap three places away cuts, and no page between mounts. | index changes |
| In the `reduced-motion` project, a 120 px drag never moves the track, and the tab changes on release. A tab tap changes the page with no travel. The strip does not slide. | reduce motion, L1 |

A jsdom component test covers J1. It counts renders and asserts that a
swipe start renders the lists screen no times. For a list of 300 tasks,
the preview renders no more rows than fit the viewport.

The browser cannot show the frame flash in V3 or the ticket 0046 flicker,
because Reanimated runs on the main thread there. The emulator and the
phone show those.

## Acceptance

- [x] Each scenario above has a failing Playwright or component test
      before its fix, and all pass after, with the mouse and with
      touch.
- [x] `list-pager`, `day-pager` and `month-pager` compute
      `touch-action: pan-y` in the browser.
- [x] The B2 test in `e2e/specs/lists.spec.ts` passes without
      `test.fail()`, and the swipe arm of `use-press-guard` is gone.
- [x] The list, the day and the month page through
      `src/components/motion/pager.tsx`. `swipe-pager.tsx`,
      `lib/swipe.ts` and `lib/swipe.test.ts` are gone.
- [x] Web reorder still works in My order, through the handlers that
      moved off the pager host.
- [x] The web grabber still resizes the day split. 0061's `Split` now
      owns the grabber, and `day-spread.tsx` holds no split handler.
- [x] Lint passes with this ticket's files out of the allowlist, except
      `lists-screen.tsx` for the 0060 reorder handlers.
- [ ] Emulator, with the `verify-monkey-tasks` Android path: on the
      list, the day and the month, a slow drag, a flick, a short drag,
      a double flick and a swipe at each end show no blank strip, no
      flash at the commit and no vertical shift on landing, in the
      recorded frames.
- [ ] Emulator: a vertical scroll with sideways drift never pages, a
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

## Review notes

- From the review of PR #81 (0055), 2026-11-07: `src/lib/swipe.ts`
  `down()` does not reset `swiping`. A mouse swipe released outside the
  list pager leaves the press guard armed, and the guard swallows the
  next row tap. The page also stays at its drag offset.
- 2026-11-08: the new design removes both causes. Gesture handler
  captures the pointer, so a release outside still ends the pan, and no
  guard exists to stay armed. The second B1 scenario above proves it.

## Outcome

Moved the list tabs, the planner day body and the month calendar onto
`src/components/motion/pager.tsx`, on `799afbd` after the 0061 rebase.
Deleted `components/swipe-pager.tsx`, `lib/swipe.ts` and
`lib/swipe.test.ts`. Also deleted `use-claimed-list.ts` and its test,
which the day split no longer used, and `hooks/use-planner-gestures.ts`,
whose day and month shifts `onSelectDay` and `onSelectMonth` replace.

Web gates, all clean:

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint src scripts e2e --max-warnings 0` | clean |
| `npx vitest run` | 79 files, 708 tests, all pass |
| `E2E_PORT=8581 npm run e2e` | 235 passed, 19 skipped, 0 failed, 0 retries |

`e2e/specs/pagers.spec.ts` runs the ticket's scenarios with the mouse
and with CDP touch, in the `motion` and `reduced-motion` projects.
The scenario names are the ticket's own: a swipe turns the list page,
a swipe that starts on a row opens no editor, a short drag keeps its
preview until the track rests, two fast drags move two tabs, a landed
tab holds no page two away, a drag right at the first list stops at
the rubber band, a tab tap one page away slides, a tab tap three pages
away cuts, a swipe on a month cell opens no day, a swipe released over
the bottom bar rests and the next tap opens, the list and day preview
screenshot pairs, a touch drag that ends in touchCancel keeps the tab,
a vertical touch drag with sideways drift scrolls and never pages, the
reduce-motion track, and the tab strip. The J1 component test is
`lists-screen.test.tsx` "renders nothing at a swipe start, and caps the
preview rows".

Decisions taken while building:

- `Pager` gained `enabled`. The lists screen passes
  `enabled={lifted == null}`, so the legacy reorder drag does not also
  page.
- The list index is the tab position. The day and month indexes count
  days and months from the mount day or month. A strip tap sets route
  state, and `onPage` writes the absolute date back.
- List rows pass 0061's `panPress`, so their press cancels under the
  pager's pan. The month cells and the month pane's open link use
  gesture handler's `Pressable`, because a swipe must not pick a day.
  Controls with no pan above them stay on `NoPanPressable` through
  `components/ui/pressable.tsx`: the tab strip, the period strip and
  the list notices.
- `day-spread.tsx` left the 0058 lint allowlist. 0061 had already
  deleted the split handlers and the touch gate the ticket wanted kept,
  and the pager host needs no banned motion path. `lists-screen.tsx`
  stays for the 0060 reorder handlers.
- The day preview draws still `PreviewRow`s and `SplitStill` from the
  same `dayRows` and one `now` in `day-spread.tsx`. It mounts no live
  `TaskRow`, `TaskListSection` or `OverdueGroup`.
- Web reorder keeps its `onPointerMove`, `onPointerUp` and
  `onPointerCancel` handlers on a plain `View` inside the list page.

Test-harness decisions:

- `press()` in `e2e/locators.ts` scrolls, waits two frames, then
  clicks. Gesture handler's web press drops a press on a target it has
  not measured, and Playwright scrolls after its own stability check,
  so a row that mounts with that scroll loses the press.
- `pickDay` retries a month cell until the picked pane shows, and the
  keyboard test in `capture-dock.spec.ts` focuses until the button holds
  focus. The toast check scopes `alert` to its text.
- The preview screenshot pairs compare pixels with a small tolerance.
  The held page stands a fraction of a pixel beside the landed page,
  and the test also asserts that the landed pager's `scrollTop` is 0.

Not proven:

- Emulator boxes: every drag, flick, double flick, end swipe, drift,
  hold-to-lift and chip strip scenario in the recorded Android frames.
- Phone boxes: the system back gesture, reduce motion on the device,
  and the 0046 phone pass.
- The browser cannot show the V3 frame flash or the 0046 flicker,
  because Reanimated runs on the main thread there.

