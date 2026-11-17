# The week planner fits one screen

- **Status:** accepted
- **Date:** 2026-11-14

## Context

Week mode draws seven columns of 144pt in a canvas of 256pt. A phone
shows two and a half of them. The body scrolls sideways, so the other
days stay reachable.

The scroll takes the horizontal gesture. Day and month turn their page
with a swipe. Week cannot, because the column scroll claims the same
gesture first.

Week mode has one main job. It places a task on a day. A hidden
Saturday breaks that job. The user needs a scroll to find it, and a drag has to
ride the scroll to reach it.

We built four throwaway layouts and compared them. A fifth shape kept
the scroll. The operator chose two of the fitted layouts and asked for
a setting to pick between them.

## Decision

The week fits one screen. The body turns with the shared pager, the
same way day and month turn.

Week mode offers two layouts. Spread leads, and Rows sits behind one
setting in the Settings screen. Both draw seven day boxes at the same
place. That way, the drag code and the drop ring do not change with
the layout.

Spread pairs two days per row, Sunday with Monday first, and Saturday
takes the last row across both columns. Rows stacks the seven days,
top to bottom.

## Consequences

A horizontal swipe on the week body now turns the week. The week body
needs a static twin for the neighbour page, the same cost the month
grid already pays.

A day shows two chips and a count, not four. A day with many tasks
reads as a number until the user opens it. Task names cut short in
Rows, at about 12 letters on a 360pt screen. Spread fits about 22.

The week body grows by about 34pt in Spread and 58pt in Rows. The task
pane under it loses that much. The pane still shows four rows above
the fold on a 360pt phone.

We leave the spread's eighth box out. A drop that means
"next week" needs a rule for a due date that covers a week. The
vault stores one date. We leave that out until a ticket defines it.

Two layouts double the test path for the week body. The setting earns
its place because the operator uses the week both as a plan and as a
list.

## Alternatives

**Keep the sideways scroll.** Today's shape. It hides Saturday from a
drag and blocks the week swipe.

**Seven narrow columns.** All seven days fit at about 47pt each. Each
target barely clears the 44pt floor, and names break into fragments.

**One wide day beside six slim marks.** The picked day opens wide and
the others show a date and a dot per task. Six days lose their names,
and the targets move while a drag travels.

**One layout only.** One default, with no choice. It halves the test
path and drops the setting. The operator asked for both.

## Amendment, 2026-11-16: the shipped geometry

Ticket 20261114 builds the fitted week. The numbers below are what
shipped.

**Spread.** Four rows of day boxes, two columns each, inside the page
gutter. The rows sit 8pt apart and the gap stays paper. Sunday pairs
with Monday, Tuesday with Wednesday, Thursday with Friday. Saturday
spans both columns of the last row. The eighth box stays out.

Each box is 68pt tall. A 4pt pad, a 14pt header line, and two 18pt
chips 4pt apart fill it. The header shows the weekday caption and the
date. When the day holds more than two tasks, the header's right
corner shows a "+N" count. The body is 296pt tall, 40pt over the old
canvas.

**Rows.** Seven 44pt lines in one card, split by hairlines. Each line
holds a 36pt date block, two 24pt chips side by side, and the "+N"
count. The body is 308pt tall.

**One day list.** `weekDays` builds the seven days once, and both
layouts draw the same `WeekDay[]`. `weekChipCount` draws two chips at
most. A table holds each layout's grid shape, its cells and its
height.

**The drop grid.** The live body is one `PlanDrag.Grid`. Each cell
holds its day's target object. Saturday's two Spread cells hold the
same object. The grid's hit test stays uniform.

The ring is a new cell-owned mark. A hover then rings the inside of
the day's own box instead of filling a cell pitch. The ring is 2pt of
ink with the box's corner. It fades over `motion.ms.tap` and follows
reduced motion. The month grid keeps its fill box.

**The count's press.** The "+N" count opens the day and leaves the
selection alone. It draws a 44pt press beside the day press. A button
may not sit inside another button.

**The swipe.** The week body is a page in the shared pager. A landing
selects the same weekday in the new week, so the rail follows. The
neighbour page is the same body with `interactive={false}`. A chip
drag never turns the page, and a swipe never lifts a chip.

**The setting.** `weekView` is `spread` or `rows`, and a fresh install
opens Spread. The browser stores it under `monkey-tasks.week-view`.
