---
title: The month pager's incoming card has no height
created: 2026-11-18
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The operator swipes the month planner on the phone. The motion is
smooth. The incoming card is wrong until the page lands. Every date
number bunches at the top of the card. The landed card is right.

The live page and the preview reach the same `MonthGrid` by two
layout chains.

- The live page sits in flow, at the pager host's width.
- The preview sits inside the track, positioned, with
  `width: "100%"` and `top: 0; bottom: 0`. Its height is the track's
  height, and the track holds only positioned children.
- A month cell takes its height from `aspectRatio: 1` over a
  percentage width. The width must be definite first.

Give a preview the host's measured box in pixels. Let the month cells
divide a row with `flex` instead of a percentage. A neighbour then has
a definite width and height when it mounts. It lays out the card
before the page shows.

Check the week pager for the same fault. Its rows carry a fixed height
and its grid a fixed `height`, so it should have none. Prove it on the
emulator with a frame grid.

## Acceptance

- [ ] A frame grid of a month swipe on the emulator shows the
      incoming card laid out on its first frame.
- [ ] The week pager shows no such fault in a frame grid.
- [ ] A component test fails before the fix and passes after it. A
      neighbour page gets the pager's box.
- [ ] tsc, eslint, vitest, the records check and the full web suite
      pass.
- [ ] `CHANGELOG.md` lists the fix under 1.2.0.

## Outcome
