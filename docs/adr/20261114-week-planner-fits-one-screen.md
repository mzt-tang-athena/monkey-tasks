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
place, so the drag code and the drop ring do not change with the
layout.

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
"next week" needs a rule for a due date that covers a week, and the
vault stores one date. We leave that out until a ticket defines it.

Two layouts double the test path for the week body. The setting earns
its place because the operator uses the week both as a plan and as a
list.

## Alternatives

**Keep the sideways scroll.** Today's shape. It hides Saturday from a
drag and blocks the week swipe.

**Seven narrow columns.** All seven days fit at about 47pt each. Each
target barely clears the 44pt minimum, and names break into fragments.

**One wide day beside six slim marks.** The picked day opens wide and
the others show a date and a dot per task. Six days lose their names,
and the targets move while a drag travels.

**One layout only.** One default, with no choice. It halves the test
path and drops the setting. The operator asked for both.
