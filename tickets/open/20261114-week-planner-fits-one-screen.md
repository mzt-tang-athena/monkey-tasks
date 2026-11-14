---
title: The week planner fits one screen and offers two layouts
created: 2026-11-14
priority: normal
assignee:
pr:
depends: [0084]
---

## Spec

Week mode shows two and a half days. Seven columns of 144pt sit in a
256pt canvas, and the body scrolls sideways. Saturday needs a scroll
to see, to pick or to drop on.

The scroll also owns the horizontal gesture. Day and month turn their
page with a swipe (ADR 0033). Week cannot, because the column scroll
takes that gesture first.

A throwaway prototype settled the layout
(`/tmp/opencode/week/proto.html`). The operator chose both fitted
layouts, plus one setting to pick between them. The week fits the
screen, and the body then turns by swipe like the other two modes.
Day and month do not change.

## Two layouts, one body

**Spread, the default.** A paper planner spread. Two columns of day
boxes, four rows, 6pt apart. Each box holds the day name, the date,
two chips and a "+N" count. Sunday pairs with Monday, Tuesday with
Wednesday, and Thursday with Friday. Saturday takes the last row at
full width.

We leave the eighth box out. A box that pushes a task to next week
needs a rule for a week-long due date, and the vault stores one date.
Read the pairing as day boxes in the week's own order, Sunday first.

**Rows.** Seven rows in one card, 44pt each, split by hairlines. A
34pt date block sits on the left, with the weekday name over the serif
number. Two chips follow, then "+N". The order reads top to bottom,
like the list pane under it.

Both layouts keep today's soft green box, the picked day's accent
edge, the day press that picks the day, and the "+N more" press that
opens the day. A drag from the pool drops on any of the seven boxes,
and the C-Ink ring from ticket 0082 hugs the content inside the box.

Every chip keeps one fixed height, so the count of chips stays
arithmetic. ADR 0041 still owns that rule.

## Swipe

The week body becomes a page in the shared pager from ADR 0033 and
ADR 0036. The pager needs a static twin of the week for the neighbour
page, like the month grid has. The period strip and the mode switch
stay still, and the rail moves to the settled week.

## Setting

`Settings` in `app/src/lib/settings.ts` gains `weekView: "spread" |
"rows"`. Add it to the type, `DEFAULTS`, `LOCAL_KEYS` and the `pick`
allowlist. The default is `spread`. Read it with
`useSetting("weekView")` from ticket 0084, so a change redraws the
mounted week.

Ticket 0084's screen gains one field in its "Lists and planner"
section. The field name is "Week view". It holds a SegmentedControl
with Spread and Rows, and the hint "Spread pairs two days per row.
Rows stack all seven."

## Files

| File | Change |
| --- | --- |
| `app/src/features/planner/components/week-view.tsx` | Both layouts behind a `layout` prop, and the seven drop cells |
| `app/src/features/planner/components/week-pane.tsx` | Reads the setting and passes the layout |
| `app/src/features/planner/planner-screen.tsx` | Puts the week body in the pager, keyed on the week |
| `app/src/features/planner/components/week-preview.tsx` | New. The static twin for the neighbour page |
| `app/src/theme/tokens.ts` | Replaces `weekColWidth` and `weekCanvasHeight` with the two layout heights |
| `app/src/lib/settings.ts` | The new key |
| `app/src/features/settings/settings-screen.tsx` | The Week view field, on ticket 0084's branch |
| `docs/adr/` | A new ADR, plus amendments to 0041 and 0033 |

## Acceptance

- [ ] A 360pt wide screen shows all seven days in week mode, with no
      horizontal scroll.
- [ ] A horizontal swipe on the week body turns to the next or the
      previous week, and the rail follows. The feel matches day and
      month.
- [ ] Both layouts keep today's mark, the picked day's edge, the day
      press and the "+N more" press.
- [ ] A drag from the pool lands on any day, Saturday included,
      without a scroll.
- [ ] A drop rings inside its own day box.
- [ ] Settings offers Week view. The choice survives a restart, and
      the mounted week redraws on the change.
- [ ] A fresh install opens Spread.
- [ ] Unit and component tests cover the chip count and the seven
      cells in both layouts. e2e covers the swipe, a drop on Saturday
      and the setting.
- [ ] The ADR records the fitted week, the two layouts and the choice.
      ADR 0041 and ADR 0033 each get a dated amendment.

## Outcome

(filled in before moving to done/)
