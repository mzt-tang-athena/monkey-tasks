# The planner hides its task half with a tap on the split handle

- **Status:** accepted
- **Date:** 2026-11-27

## Context

The planner has two halves. The calendar sits on top. The task list
sits under a divider. The operator asked for a control that hides the
list, so the calendar takes the whole screen.

Day drags its divider (ADR 0046). Week and Month hold theirs still. Two
open tickets make Week and Month drag too, and prove the Day range on
Android. A hide control must not fight a drag.

The ticket named three places for the control. We drew each at phone
width, in `evidence-planner-hides-tasks/frames/placement-*.png`.

## Decision

A tap on the split handle hides the list. A second tap shows it. The
handle is the grip that already sits on the divider in all three views.
It stays at the bottom edge when the list hides, so the way back
stays on screen.

**Hide is a state, apart from the split.** Day keeps its stored share
through a hide. A show returns to that share. A drag works only while
the list shows, and it never hides the list. The floor of one row
(ADR 0046) still holds. The two open drag tickets build on the same
rule. Their share and their floors do not change, and a hidden list
needs no case in them.

**Where the choice lives.** A setting, `plannerTasks`, holds it. It
reads "on" or "off", like the Today list's switch. It starts on and
survives a restart. All three views read it, so a choice made in Week
holds in Day.

**What the calendar does.** Week's boxes grow to fill the screen. The
seven days still fit one screen (ADR 20261114-week-planner-fits-one-screen).
Month's rows share the spare height. Each month cell stays square and
centers in its row. A tall cell needs the cell width. Android only
learns it after layout, and that moves the first frame.

**Motion.** The hide runs on the UI thread over the settle clock, with
one 0 to 1 value. With reduced motion it lands at once. The task half
leaves the tree when the hide ends. A keyboard or a screen reader
then never reaches a row with no height.

**The handle in Day.** It stays one slider node through a hide, so a
keyboard keeps its focus. The value text reads "tasks hidden". Enter and
Space toggle it, and TalkBack gets a "hide tasks" or "show tasks"
action. A tap is its own tap gesture beside the pan. On Android a pan
that never moves never activates, so it cannot tell a tap from a cancel.

## Consequences

We add no chrome. A user who never finds the tap never sees the
feature. We accept that, because the handle is the largest quiet target
on the screen.

A tap that meant to start a drag, and lets go without moving, hides the
list. Eight points of travel or half a second ends a tap.

Month's hidden grid shows spread rows with square cells. A taller cell
would be a larger target. We can add it later with a measured size.

## Alternatives

**A chevron beside the list title.** It needs a header row that stays
when the list hides, so the calendar gives up 44pt. It also puts a
second chevron next to the source label's own. We drew it and left it.

**A command in the command pane.** It adds no pixels and gives the
keyboard a named command. Nothing on screen then shows the hide, and
nothing on screen brings the list back. We left it, and it can
join the handle later as a second way in.

The operator has not yet picked from the frames. This record follows
the recommended placement. If the operator picks another, we add a
dated amendment.
