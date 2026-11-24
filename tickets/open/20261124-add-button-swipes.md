---
title: One wide Add button that swipes to commands and tabs
created: 2026-11-24
priority: high
assignee:
pr:
depends: []
---

## Spec

The operator's feedback on 2026-11-24: try a new control in the bottom
right corner.

- The split pill (plus and ⌘) changes back to one wider Add button.
  That drops the ⌘ half, a tap target of its own today. The swipe down
  and a TalkBack action take over its job.
- A tap adds, as today.
- A swipe down on the button opens the command pane.
- A swipe left or right on the button switches tabs.
- The swipe on the bar's empty middle goes away. The button replaces it.

Notes for the build:

- A tap and the three swipes need clear thresholds, so a slightly moving
  tap still adds. Reuse the gesture rules the pagers use.
- Name the direction a swipe moves the tabs in the ADR. Default: a
  left swipe goes to the tab on the right, as a pager does.
- TalkBack and keyboard: the button carries custom actions for "open
  commands", "next tab" and "previous tab". The hardware shortcut for
  the pane stays.
- Give a small hint of motion as the finger moves. A swipe then reads
  as a swipe, where a still button would feel like a missed tap.
- Amend ADR `20261111-command-pane` and `20261117-icon-only-bottom-bar`.

## Acceptance

- [ ] A tap on the button opens Add.
- [ ] A swipe down on the button opens the command pane.
- [ ] A swipe left or right switches to the next tab that way.
- [ ] The bar's empty middle no longer opens the pane.
- [ ] TalkBack reads three custom actions on the button.
- [ ] Web e2e covers each gesture in both motion projects.
- [ ] Emulator frames show each gesture mid-swipe.

## Outcome

(filled in before moving to done/)
