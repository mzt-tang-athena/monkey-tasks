---
title: The week planner fits one screen and offers two layouts
created: 2026-11-14
priority: normal
assignee: opencode
pr: 151
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
needs a rule for a week-long due date. The vault stores one date.
Read the pairing as day boxes in the week's own order, Sunday first.

**Rows.** Seven rows in one card, 44pt each, split by hairlines. A
34pt date block sits on the left, with the weekday name over the serif
number. Two chips follow, then "+N". The order reads top to bottom,
like the list pane under it.

Both layouts keep today's soft green box and the picked day's accent
edge. Both keep the day press that picks the day, and the "+N more"
press that opens the day. A drag from the pool drops on any of the seven boxes. The C-Ink
ring from ticket 0082 hugs the content inside the box.

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

- [x] A 360pt wide screen shows all seven days in week mode, with no
      horizontal scroll.
- [x] A horizontal swipe on the week body turns to the next or the
      previous week, and the rail follows. The feel matches day and
      month.
- [x] Both layouts keep today's mark, the picked day's edge, the day
      press and the "+N more" press.
- [x] A drag from the pool lands on any day, Saturday included,
      without a scroll.
- [x] A drop rings inside its own day box.
- [x] Settings offers Week view. The choice survives a restart, and
      the mounted week redraws on the change.
- [x] A fresh install opens Spread.
- [x] Unit and component tests cover the chip count and the seven
      cells in both layouts. e2e covers the swipe, a drop on Saturday
      and the setting.
- [x] The ADR records the fitted week, the two layouts and the choice.
      ADR 0041 and ADR 0033 each get a dated amendment.

## Outcome

Week mode draws seven day boxes on one screen in two layouts, Spread
and Rows. It turns by swipe in the shared pager. A pool task drops on
any day, Saturday included, with no scroll. The drop target rings
inside the day's own box.

**Shipped geometry.** Spread pairs Sunday with Monday and so on.
Saturday spans the last row, 320pt wide on a 360pt screen. Each box is
68pt tall and the body is 296pt. Rows stacks seven 44pt lines in one
card and the body is 308pt. Both layouts draw two chips at most, then a
"+N" count.

**The ring.** `PlanDrag.Grid` takes `mark="ring"`. It draws no box and
gives each cell a `Ring` that fills the box it renders in. The mark is
2pt of ink. It fades over `motion.ms.tap` and follows reduced motion.
Saturday's two cells hold one target object. Either cell rings the one
box. The month grid keeps its fill box.

**The pager.** `WeekPane` puts the body in the `Pager` as `week-pager`.
A landing selects the same weekday in the new week, so the rail
follows. The neighbour page is `WeekView interactive={false}`. A chip
drag turns no page, and a swipe lifts no chip.

**The setting.** `weekView` sits in `Settings`, defaults to `spread`,
and stores under `monkey-tasks.week-view`. Settings gains the "Week
view" field with Spread and Rows.

**Gates.** tsc, lint with zero warnings, and 875 unit and component
tests. Web export, and the full Playwright suite on that build.

**Proved on the web build only.** The "restart" in the setting reads a
page reload here. A device build was not run. Screenshots at 360x640
and 412x915, light and dark, are in /tmp/opencode/week-build.
