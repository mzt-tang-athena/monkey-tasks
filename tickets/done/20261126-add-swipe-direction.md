---
title: The Add button's sideways swipe follows the selection
created: 2026-11-26
priority: normal
assignee: opencode
pr: 241
depends: []
---

## Spec

The operator tried 1.3.0 on the phone. A sideways swipe on the Add
button "is the opposite direction of how it should go, but it works".
The button read a swipe as a pager reads one. A leftward drag turned to
the next tab, because a page's track follows the finger. The bar has no
track. The selection is what moves, under the finger.

After this ticket, a rightward drag on the Add button goes to the next
tab. A leftward drag goes to the previous one. The ends still hold, with
no wrap.

The pager keeps its mapping. A page's track follows the finger. A
leftward drag still turns to the next page there. Only the Add button
flips, and its nudge rubber bands at the end the drag cannot reach.

## Acceptance

- [x] A rightward drag on the Add button lands the next tab.
- [x] A leftward drag lands the previous tab.
- [x] The first and last tab still hold, with no wrap.
- [x] The button barely moves past either closed end.
- [x] The unit tests and the web e2e hold in both motion modes.
- [x] ADR `20261111-command-pane` carries a dated amendment.
- [x] A 1.4.0 changelog line names the new direction.
- [x] An emulator run shows a right swipe landing the next tab.

## Outcome

The Add button's sideways swipe now moves the selection the finger's
way. A rightward drag goes to the next tab, and a leftward one to the
previous. Both ends hold, and the button barely moves past a closed
one.

`follow` in `pager-math.ts` takes the drag that reaches the next page.
The pager keeps its leftward mapping. The bar asks with a rightward
one. ADR `20261111-command-pane` carries the 2026-11-26 amendment, and
1.4.0 has a changelog line.

Proof: the unit tests, `add-button.spec.ts` in both motion projects,
and a Pixel 7 emulator run on port 5574. The frames sit in the PR.
