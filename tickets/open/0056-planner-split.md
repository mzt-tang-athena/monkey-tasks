---
id: 0056
title: Split the planner and give drag one home
created: 2026-10-26
priority: high
assignee:
pr:
depends: [0054]
---

## Spec

ADR 0025 made `PlannerScreen` a composition root and gave drag one home
in `usePlannerGestures`. Day mode never joined it. `DaySpread.tsx` (742
lines) holds a second copy of the hold, lift, pending, ghost, gate and
drop code (`DaySpread.tsx:101-311` and `DaySpread.tsx:385-504`, against
`usePlannerGestures.ts:46-300`). The copies already differ.
`DaySpread`'s pointer up arms the click guard on every platform
(`DaySpread.tsx:492-497`), but its native drop arms it on web only
(`DaySpread.tsx:302-307`). `plannerStyles.ts` (828 lines) serves every
component, and 20 of its keys have no reader.

Split the planner, give drag one hook, and fix the five bugs below. Each
bug gets a failing test before its fix.

Paths and line numbers cite commit `b2c0b10`. Ticket 0050 renames files
to kebab-case, so look for the same code under its new name.

### Target files in `src/features/planner/`

| File | Holds | Code today |
|---|---|---|
| `planner-screen.tsx` | Route state, store reads, providers, layout | `PlannerScreen.tsx` |
| `components/planner-list-context.tsx` | Source, form, menu state, cycle, form change, lift, drag API, toggle, open, drag start | Nine props that `PlannerScreen.tsx:156-173`, `PlannerScreen.tsx:209-229` and `PlannerScreen.tsx:249-281` pass into `DaySpread` (16 props) and `TaskListSection` (17 props) |
| `hooks/use-planner-source.ts` | Source state and the chooser state | `PlannerScreen.tsx:57-84` |
| `components/source-menu.tsx` | The chooser on `Menu` | `PlannerScreen.tsx:309-367`, `SourceToggle.tsx:59-64` |
| `hooks/use-drag-session.ts` | Pending press, hold, arm, lift, ghost values, touch gate, click guard and drop. It takes the zone map, the ghost origin, and `resolve(hitKey)`, which returns a patch or null. | `usePlannerGestures.ts:46-300`, `DaySpread.tsx:101-311`, `DaySpread.tsx:385-504` |
| `hooks/use-split-pane.ts` | Root height, body top, pane offset, timeline height, resize, grabber pan and limit | `DaySpread.tsx:90-100`, `DaySpread.tsx:237-243`, `DaySpread.tsx:313-356` |
| `lib/day-rows.ts` | Day tasks, timed tasks, overdue, list rows and section tasks as pure functions | `DaySpread.tsx:358-383`, `DayPreview.tsx:45-62` |
| `components/day/day-spread.tsx` | The day composition | `DaySpread.tsx` |
| `components/day/day-heading.tsx` | Eyebrow, serif date and rule | `DaySpread.tsx:591-597`, `DayPreview.tsx:67-73` |
| `components/day/timeline-pane.tsx`, `split-handle.tsx`, `day-list-pane.tsx`, `overdue-group.tsx` | The parts of `renderBody` | `DaySpread.tsx:599-735` |
| `components/week-pane.tsx`, `components/month-pane.tsx` | The week and month bodies | `PlannerScreen.tsx:192-283` |
| `components/drag-ghost.tsx` | One ghost, through `OverlayHost` at `layers.ghost` | `PlannerScreen.tsx:288-307`, `DaySpread.tsx:562-581` |
| `planner-layout.ts` | The shared frame and pane styles only | parts of `plannerStyles.ts` |

Move every other style next to its component. Ticket 0048 deleted the
keys with no reader (`strip*`, `segmented*`, `segmentMiddle`,
`liftHold`, `liftPicked` and `railBleed`). Their live copies sit in
`PeriodStrip.tsx`, `PlannerHeader.tsx` and `drag.tsx`. Use
`SegmentedControl` for the mode switch and the form toggle,
`SectionHeader` for the section labels, and the state primitives in
place of `PlannerStates.tsx`.

`usePlannerGestures` keeps the day and month shifts and calls
`use-drag-session` for drag. Keep the hook order and effect order that
ADR 0025 asks for. Add a dated amendment to ADR 0025 that names
`use-drag-session` as the one home for drag in all three modes.

The motion stays on today's Animated values. Keep it behind
`use-drag-session` and the pager calls, so tickets 0059 and 0061 can
swap the internals.

Pass stable callbacks. Today `cycleSource` runs inline three times
(`PlannerScreen.tsx:162`, `PlannerScreen.tsx:214`,
`PlannerScreen.tsx:254`). `guardedToggle`, `guardedOpen`,
`guardedSelect` and `startDayDrag` change on every render
(`usePlannerGestures.ts:196-244`). `renderBody` and `BodySlot` rebuild
the day body on every render (`DaySpread.tsx:46-48`,
`DaySpread.tsx:587`). `TaskListSection` builds `renderItem` inline
(`TaskListSection.tsx:76-86`). If ticket 0055 has landed, use its
`src/hooks/use-press-guard.ts` for the click guard.

### Bugs

1. **The swipe preview and the live day disagree.** For a day other than
   today, `DaySpread` lists `tasksForDayAll` (`DaySpread.tsx:370`), and
   that includes recurrences. `DayPreview` lists only notes whose stored
   due date matches (`DayPreview.tsx:47-51`). To reproduce, add a weekly
   task stored last week with an occurrence tomorrow. In day view, start
   a swipe toward tomorrow. The preview lacks the task. Release, and the
   task appears as the page lands. After the fix both read
   `lib/day-rows.ts`.
2. **Week columns cut off.** The week canvas has a fixed height of 256
   (`tokens.ts:167`, `plannerStyles.ts:623-628`), and a column grows with
   its chips (`WeekView.tsx:87-103`). To reproduce, put 8 tasks on one
   day and open week view. The column stops after about 6 chips and
   gives no sign of the rest. Show the chips that fit and a `+N more`
   line that opens that day. If you pick another fix, write an ADR.
3. **The planner has two sources for today.** `usePlannerRoute` keeps
   the date from mount time (`usePlannerRoute.ts:31`), but the screen
   passes `new Date()` on each render (`PlannerScreen.tsx:158`,
   `PlannerScreen.tsx:182`, `PlannerScreen.tsx:196`,
   `PlannerScreen.tsx:236`). To reproduce with fake timers, mount at
   23:59 and advance past midnight. The strip tints the new day, but the
   default day stays on the old one. Add `src/hooks/use-today.ts`: one
   start-of-day date that changes at midnight and when the app returns
   to the foreground.
4. **The stacking order changes with the mode.** The week and month
   ghost sets `zIndex: 20` at the screen root (`plannerStyles.ts:398-402`)
   and draws over the bottom bar. The day ghost lives inside the day
   root (`DaySpread.tsx:562-581`) and draws under the bar. The source
   menu backdrop stops at the bar (`PlannerScreen.tsx:310-371`), so with
   the menu open a tap on Lists navigates. Draw the ghost and the menu
   through `OverlayHost`.
5. **The source menu leaves the visible area.** `SourceToggle.tsx:59-64`
   places the menu below the toggle and clamps the left side only. To
   reproduce at 360 by 640, open month mode and hold the source toggle.
   The last items fall under the bottom bar. `Menu` flips and clamps it.
6. **Day lists sort a recurring task by the day it is stored on.**
   `sortOpenFirst` (`model.ts:108-124`) sorts by the full stored
   timestamp. On a day other than today, the day list holds each
   recurrence that falls on it (`DaySpread.tsx:364-370`). A daily task
   stored yesterday at 7:00 PM therefore sorts above a task due that
   day at 2:30 PM. `DayPreview.tsx:48-62` sorts the same way. The month
   view's picked-day list (`usePlannerMonth.ts:60`) does not sort at
   all. The week column already sorts with `sortByTimeOfDay`
   (`WeekView.tsx:63`). To reproduce in the web preview, keep the e2e
   clock (Monday 26 October 2026), open day view and step to Tuesday
   27: Supplements (7:00 PM) shows above Dentist (2:30 PM). Give
   `lib/day-rows.ts` one sort for a day: open first, then all-day
   tasks, then by time of day.
7. **Overdue rows have no separators.** The overdue block maps its rows
   with no hairline between them (`DaySpread.tsx:721-735`). The list
   below draws one through `RowSeparator`
   (`TaskListSection.tsx:104`, `TaskListSection.tsx:152-160`). To
   reproduce, open day view on today with two overdue tasks. Use the
   same separator in both.

Line numbers in this ticket predate tickets 0048 and 0050. Look each
one up again, and use the path map in the 0050 Outcome.

## Acceptance

- [ ] `planner-screen.tsx` reads route and store state, mounts the providers and lays out the panes. It holds no drag state and no menu state.
- [ ] `DaySpread` and `TaskListSection` take no source, form, menu, lift or drag API props. They read `PlannerListContext`.
- [ ] Day, week and month drags all run through `use-drag-session`.
- [ ] No other file holds pending, lift or ghost state.
- [ ] In every mode, a drop arms the click guard on web only.
- [ ] ADR 0025 has a dated amendment for `use-drag-session`.
- [ ] `plannerStyles.ts` no longer exists, and `planner-layout.ts` holds only frame and pane styles.
- [ ] `lib/day-rows.ts` has unit tests.
- [ ] A test reproduces the preview bug first. Afterwards, for a recurring task, the preview and the live day list the same rows.
- [ ] A test reproduces the week overflow first. Afterwards a column with 8 tasks shows `+N more`, and a press on it opens that day.
- [ ] A fake-timer test reproduces the today bug first. Afterwards, past midnight, the strip tint and the default day agree.
- [ ] A Playwright test reproduces the stacking bug first. Afterwards the ghost draws above the bottom bar in day, week and month mode.
- [ ] With the source menu open, a tap on the bottom bar closes the menu and does not navigate.
- [ ] A Playwright test at 360 by 640 reproduces the menu bug first. Afterwards the open source menu sits fully above the bottom bar.
- [ ] A Playwright test reproduces the sort bug first. Afterwards the day list, the swipe preview and the month picked-day list each show a day's tasks by time of day.
- [ ] A Playwright screenshot reproduces the separator bug first. Afterwards overdue rows and list rows show the same hairline.
- [ ] A render-count test shows that a hover change during a day drag re-renders the timeline and not the list pane.
- [ ] A drag from the list to the ruler still writes the hour, and a drag to a week column or month cell still writes the day.
- [ ] `npx eslint src`, `npx tsc --noEmit`, the test suite and the Playwright suite pass.

## Outcome

(filled in before moving to done/)
