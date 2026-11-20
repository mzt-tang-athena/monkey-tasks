---
title: The command pane rises from below
created: 2026-11-20
priority: normal
assignee:
pr:
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

- [ ] The pane rises from the bottom edge, on the web and the emulator.
- [ ] The search field sits above the keyboard when it opens.
- [ ] A drag down closes it. Back closes it.
- [ ] Reduced motion shows it with no slide.
- [ ] The ADR has the dated amendment.

## Outcome

(filled in before moving to done/)
