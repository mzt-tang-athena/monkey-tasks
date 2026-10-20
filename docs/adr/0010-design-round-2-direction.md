# 0010. Design round 2 direction: budget green on paper

- **Status:** accepted
- **Date:** 2026-10-20

## Context

Round 1 of the design exploration (ticket 0016) produced three
variants. The user reviewed them and gave combination notes. Variant
B's structure won, with changes. The notes constrain round 2 and the
locked theme.

## Decision

We restyle variant D "budget green on paper" as the round 2 entry.

- The accent is the monkey-budget deep green `#0f4031` on warm cream
  paper `#f7f4d5`. One green accent. Variant A's blue read as "too
  googly"; B's sage is replaced. Overdue keeps a muted warm red.
- Group headers are plain text on the paper, not cards. The card
  groups of B and C felt crowded; the list should breathe.
- Capture is a persistent inline composer: a pill text field docked
  above the bottom bar, with the target-list chip inline. We drop the
  round plus-in-a-circle button. A round button wastes space and
  reads as a button, not an invitation to type. The full capture
  sheet stays, opened from the composer's expand affordance.
- The planner day spread keeps B's serif date header and gains C's
  hour-ruler timeline. It adds an unscheduled tray docked at the
  bottom of the spread: undated tasks wait there and read as drop
  targets for the ruler. The drag itself is ticket 0017.
- Screens cap their content width at 720 on wide screens so the
  desktop export keeps a phone-like measure.

## Consequences

The theme module now carries the budget palette, so the winning
round 2 variant can lock it without a color pass. The composer moves
capture above the bottom bar on both tabs; the CaptureSheet survives
only as the detail form behind the composer, so its input flow must
keep accepting a carried-over draft. The tray is visual only until
0017 lands the drag.
