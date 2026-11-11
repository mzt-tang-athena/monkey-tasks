---
id: 0063
title: Accessibility and touch targets
created: 2026-10-26
priority: high
assignee: omp
pr: 105
depends: [0049, 0055, 0056, 0057, 0060]
---

## Spec

TalkBack users and small fingers both struggle with the app today. This
ticket fixes the accessibility findings from the epic 0047 audit. It runs
after the screen tickets and the reorder rebuild land, so it edits the
new files.

Ticket 0049 already swaps `accessibilityState` for `aria-*` props at its
seven sites and names the reorder grip. This ticket adds new states with
the same `aria-*` props, never with `accessibilityState`.

Paths and line numbers cite commit `b2c0b10`. Tickets 0050 and 0055 to
0057 move this code, so look for the same code under its new name.

### Findings

1. **Rows have no names.** `TaskRow.tsx:197-204` labels every row body
   "open task", so TalkBack reads the same words for each row. The circle
   (`TaskRow.tsx:180-182`) reads "mark done" with role `button`. The
   timeline tick (`Timeline.tsx:128-133`) reports no state. Make each
   circle a `checkbox` named by its task. Name the row body by the task
   and its meta, for example "Buy milk, 3:00 PM, overdue".
2. **Touch targets fall under 44 by 44.** Grow the pressable box and
   keep the visible mark the same size. The Playwright check measures
   layout boxes, and a layout box does not include `hitSlop`, so a
   target must reach 44 by layout. If the month grid cannot reach 44 at
   360pt wide without starving the list pane on a 640pt screen, record
   the exception in an ADR.

   | Control | Size now | Code |
   |---|---|---|
   | Timeline tick | 18 by 18 | `Timeline.tsx:128`, `plannerStyles.ts:583-591` |
   | Error Dismiss | about 22 high | `index.tsx:1283-1287` |
   | Editor Cancel | about 22 high | `TaskEditorScreen.tsx:165-172` |
   | Form toggle segment | 32 by 26 | `plannerStyles.ts:110-116` |
   | Source toggle | 32 high | `plannerStyles.ts:440` |
   | Open in day view | 32 high | `plannerStyles.ts:775` |
   | Icon button | 36 by 36 | `IconButton.tsx:39-40` |
   | Save and Retry | 36 high | `TaskEditorScreen.tsx:453`, `plannerStyles.ts:811` |
   | Mode segment | 38 high | `PlannerHeader.tsx:17-23` |
   | Menu item | 40 high | `index.tsx:1344`, `plannerStyles.ts:488` |
   | Month cell | about 42 by 38 at 360pt | `plannerStyles.ts:742-749` |
   | Task circle | 24 by 24 by layout | `TaskRow.tsx:168-177` |

3. **Errors stay silent.** The list write error (`index.tsx:939-958`),
   the editor save error (`TaskEditorScreen.tsx:314-318`) and the
   capture toast (`BottomBar.tsx:281-309`) carry no alert role. After
   tickets 0055 and 0057 they render through `Banner` and `Toast`. Check
   that each one announces, and fix any that does not.
4. **Some features work by drag only.** Only a drag on a row or its
   grip (`ReorderRow.tsx:69-80`) reorders a row. The split grabber
   (`DaySpread.tsx:642-650`) reports role `button` with no action. Give
   each row in My order the actions Move up, Move down, Move to top and
   Move to bottom. They write through the same reorder path as a drop.
   Give the grabber role `adjustable`, with increment and decrement
   actions that move the split by one hour row.
5. **States and names are missing.** The editor fields take their name
   from the placeholder (`TaskEditorScreen.tsx:410`). The period strip
   (`PeriodStrip.tsx:215`) and the month cells (`MonthGrid.tsx:158`) mark
   the selected day by color only, and a month cell never says that it
   holds tasks. The sort and list menu buttons (`index.tsx:889-915`)
   report no expanded state. The list tabs, the mode switch, the form
   toggle and the bottom nav have no `tablist` around them.
6. **Overlays leave focus behind.** The review of 0054 (#77) found two
   gaps in the shared primitives. Line numbers cite commit `897373a`.
   - `components/ui/menu.tsx:188` sets `aria-checked` on role
     `menuitem`, which ARIA does not allow. A selected item takes
     `menuitemradio` or `menuitemcheckbox`.
   - On the web, `components/ui/overlay-host.tsx:24-28` and `:64` set
     `aria-hidden` on the screen while focus stays on the control that
     opened the overlay. Chrome then ignores `aria-hidden` and logs a
     warning. Menu and Sheet do not move focus into the overlay. Move
     focus in on open and back to the opener on close, and make the
     screen behind a modal inert.

Add `@axe-core/playwright` as a dev dependency for the screen scans.

## Acceptance

- [x] Every state this ticket adds uses an `aria-*` prop, and `grep -rn accessibilityState app/src` still finds no match.
- [x] A test reproduces the row name bug first. Afterwards a query for role `checkbox` with the task's name finds its circle, and `aria-checked` follows the tick.
- [x] A row body's accessible name holds the task name and its meta.
- [x] The timeline tick reports role `checkbox` and `aria-checked`.
- [x] A Playwright check reproduces the target bug first. It covers Lists, Planner in day, week and month mode, the editor, and the open capture sheet.
- [x] Afterwards every element with role button, tab, checkbox, radio, option, gridcell, menuitem, link or switch has a layout box of at least 44 by 44, or appears in the ADR's exception list.
- [x] A test reproduces the silent error first. Afterwards the list write error, the repair notice, the editor save error and the capture failure toast each report role `alert`.
- [x] A test reproduces the reorder gap first. Afterwards the Move down action on the first row in My order moves it to second place and writes the new order.
- [x] The split grabber reports role `adjustable`, and increment and decrement change the timeline height.
- [x] Each editor field's accessible name equals its label.
- [x] The selected period strip cell and the selected month cell report `aria-selected`.
- [x] A month cell with tasks says so in its accessible name.
- [x] The sort and list menu buttons report `aria-expanded`.
- [x] Every `aria-checked` sits on a `checkbox`, `radio` or `switch`, and every `aria-selected` on a `tab`, `option`, `gridcell` or `row`. Ticket 0049 put `aria-checked` on the tick and `aria-selected` on the sort options while both still had role `button`, which ARIA does not allow. The sort options become `radio` items in a `radiogroup`.
- [x] Each tab group sits inside a `tablist`.
- [x] Playwright runs axe-core on each screen and finds no serious or critical issue.
- [x] `npx eslint src`, `npx tsc --noEmit`, the test suite and the Playwright suite pass.

## Outcome

Every finding is fixed on the web build. Each new state uses an
`aria-*` prop, and `grep -rn accessibilityState app/src` finds nothing.

Where each finding lives now:

1. Rows. `components/task-row.tsx` makes the circle a `checkbox` named
   by its task, and the row body carries the task and its meta.
   `features/planner/components/timeline.tsx` gives the tick the same
   role and `aria-checked`.
2. Targets. Each press box is 44 by 44 and the visible mark keeps its
   size. The month card's side padding drops to 4, so a cell is 44.4
   wide at 360pt. At 320pt it would be under 44; no ADR exception is
   needed for the ticket's 360pt reference.
3. Errors. The list write error, the repair notice, the editor save
   error and the capture toast each render through `Banner` or `Toast`,
   which report `alert`. New tests pin all four.
4. Non-drag. A row in My order has an actions menu: Move up, Move down,
   Move to top and Move to bottom. Each move writes the same
   `ReorderEvent` a drop writes. The split grabber reports `adjustable`
   on native, `slider` on the web, and its increment and decrement move
   one hour row. Arrow keys run the same step on the web.
5. Names and states. Editor fields take their label as their name. The
   period strip and month cells report `aria-selected`. A month cell
   names its task count. The sort and list buttons report
   `aria-expanded`. Every tab group sits in a `tablist`. The sort
   options are radios in a `radiogroup`.
6. Overlays. A selected menu item is a `menuitemradio`, and the sort
   menu is a radiogroup. Menu and Sheet take focus in and return it.
   The screen behind a modal is `inert` on the web. ADR 0040 carries a
   2026-11-10 amendment for that change.
7. Axe. `@axe-core/playwright` scans Lists, Planner day, week and month,
   the editor and the capture sheet. No serious or critical issue
   remains.

The muted ink in each theme is a step darker, so secondary text clears
4.5 to 1 on the paper and on the soft fill.

Not proven here: TalkBack reads the names and the increment and
decrement actions on a phone. The Android emulator and the phone stay
unchecked, and a hardware keyboard check stays with the operator.

## Amendment, 2026-11-11: the non-drag path moves onto the grip

Ticket 0086 removes the row's actions menu. The row body no longer
starts a drag, so the horizontal swipe between lists works. The grip is
the one drag source, and it keeps the non-drag path.

The grip reports `adjustable` on native and `slider` on the web. Its
name is `reorder <task>`. Its value is the row's one-based place in My
order, from 1 to the group's size. Increment moves the row one place
later and decrement one place earlier. Each step writes the same
data-index `ReorderEvent` a drop writes. Arrow keys run the same step
on the web. The menu's four moves are gone with the menu.

The trade-off is unchanged in kind: a user must find the grip. It
stays visible in My order, and its name and value explain it to
TalkBack. The register entry stays unchecked until an emulator or a
phone drives the two actions.
