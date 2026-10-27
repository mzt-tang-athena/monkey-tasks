---
id: 0063
title: Accessibility and touch targets
created: 2026-10-26
priority: high
assignee:
pr:
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

Add `@axe-core/playwright` as a dev dependency for the screen scans.

## Acceptance

- [ ] Every state this ticket adds uses an `aria-*` prop, and `grep -rn accessibilityState app/src` still finds no match.
- [ ] A test reproduces the row name bug first. Afterwards a query for role `checkbox` with the task's name finds its circle, and `aria-checked` follows the tick.
- [ ] A row body's accessible name holds the task name and its meta.
- [ ] The timeline tick reports role `checkbox` and `aria-checked`.
- [ ] A Playwright check reproduces the target bug first. It covers Lists, Planner in day, week and month mode, the editor, and the open capture sheet.
- [ ] Afterwards every element with role button, tab, checkbox, radio, option, gridcell, menuitem, link or switch has a layout box of at least 44 by 44, or appears in the ADR's exception list.
- [ ] A test reproduces the silent error first. Afterwards the list write error, the repair notice, the editor save error and the capture failure toast each report role `alert`.
- [ ] A test reproduces the reorder gap first. Afterwards the Move down action on the first row in My order moves it to second place and writes the new order.
- [ ] The split grabber reports role `adjustable`, and increment and decrement change the timeline height.
- [ ] Each editor field's accessible name equals its label.
- [ ] The selected period strip cell and the selected month cell report `aria-selected`.
- [ ] A month cell with tasks says so in its accessible name.
- [ ] The sort and list menu buttons report `aria-expanded`.
- [ ] Every `aria-checked` sits on a `checkbox`, `radio` or `switch`, and every `aria-selected` on a `tab`, `option`, `gridcell` or `row`. Ticket 0049 put `aria-checked` on the tick and `aria-selected` on the sort options while both still had role `button`, which ARIA does not allow. The sort options become `radio` items in a `radiogroup`.
- [ ] Each tab group sits inside a `tablist`.
- [ ] Playwright runs axe-core on each screen and finds no serious or critical issue.
- [ ] `npx eslint src`, `npx tsc --noEmit`, the test suite and the Playwright suite pass.

## Outcome

(filled in before moving to done/)
