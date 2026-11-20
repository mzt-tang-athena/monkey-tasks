---
title: The command pane rises from below
created: 2026-11-20
priority: normal
assignee: omp
pr: 203
depends: []
---

## Spec

The operator's note from the 1.2.0 phone check on 2026-11-20. The
command pane should slide in from below, the way Obsidian's does. It
should not drop from the top.

ADR `20261111-command-pane` chose the top edge. #168 kept it when the
pane learned to open from a swipe on the bar's gap. The pane now opens
from the bottom bar. A pane that rises from below meets the finger where
the gesture starts.

Rework the pane to rise from the bottom edge:

- The search field sits at the bottom, near the thumb and the keyboard.
- The rows read upward from the search field.
- A drag down on the pane closes it, and the swipe that opens it can
  follow the finger.
- The keyboard lifts the pane the way it lifts a sheet.

Record the change as a dated amendment to the ADR.

## Acceptance

- [x] The pane rises from the bottom edge, on the web and the emulator.
- [x] The search field sits above the keyboard when it opens.
- [x] The rows read upward from the search field.
- [x] A drag down closes it.
- [x] Back closes it.
- [x] Reduced motion shows it with no slide.
- [x] The ADR has the dated amendment.

## Outcome

The pane sits at the bottom edge and rises on the pane spring.
The search is its lowest block; the rows read up from it.
A drag down on the title row follows the finger and closes.
The bar's gap takes an upward swipe, and the pane rises with it.
The panel rides the keyboard on the sheet's lift, capped to the room
above the keys.
`PaneRise` in `components/motion` owns the rise and the drag in one
transform, so a dragged dismiss leaves once.
The pull tokens lose `bar` and `close`.
The search takes `autoFocus`: a focus from an effect left the phone's
keyboard down.
ADR `20261111-command-pane` carries the 2026-11-20 amendment.

Proof: `commands.spec.ts` passes in both motion projects.
The component tests pass 17 of 17.
The emulator run is
`app/build/verify/evidence/android-20261120-095625`.
It holds the rise frames, the keyboard shot and the drag-close frames.
Its keyboard shot ends the search 16dp above the keys.
Its reduced-motion shot shows the pane at rest one frame after a tap.
Back goes to the keyboard first, as the platform gives it.
The second Back closes the pane.

Next: a phone pass on the operator's keyboard app. The emulator's IME
does not prove their inset, and it does not prove feel.
