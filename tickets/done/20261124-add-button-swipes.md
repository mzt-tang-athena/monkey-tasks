---
title: One wide Add button that swipes to commands and tabs
created: 2026-11-24
priority: high
assignee: poteto-mode
pr: 227
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

- [x] A tap on the button opens Add.
- [x] A swipe down on the button opens the command pane.
- [x] A swipe left or right switches to the next tab that way.
- [x] The bar's empty middle no longer opens the pane.
- [x] TalkBack reads three custom actions on the button.
- [x] Web e2e covers each gesture in both motion projects.
- [x] Emulator frames show each gesture mid-swipe.

## Outcome

The bar's action is one wide Add button. A tap adds. A swipe down opens
the command pane, and a swipe left or right moves one tab. The tabs stop
at their ends. The button moves up to 12pt with the finger, and reduce
holds it still. A release under the 24pt commit adds, so a tap that
moved still adds. The bar's empty middle carries no gesture. Its pull
surface leaves the tree too.

The three jobs sit on the button as custom actions for TalkBack and on
the arrow keys. "Open commands" leaves the bar's names, so a keyboard
or a screen reader reaches the pane from the button.

Proof:

- `add-button.spec.ts` in both motion projects, and the `swipe-press`
  unit tests.
- Emulator frames mid-swipe on the Pixel 7 with this branch's APK. The
  button moves 8px, 12dp. A tap moves none.
- The release smoke, its theme and pane steps on the button.

Next: nothing here. 1.3.0's Command pane section is ready to cut.
