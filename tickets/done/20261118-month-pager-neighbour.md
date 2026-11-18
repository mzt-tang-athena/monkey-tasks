---
title: The month pager's incoming card has no height
created: 2026-11-18
priority: high
assignee: omp
pr: 173
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

- [x] A frame grid of a month swipe on the emulator shows the
      incoming card laid out on its first frame.
- [x] The week pager shows no such fault in a frame grid.
- [x] A component test fails before the fix and passes after it. A
      neighbour page gets the pager's box.
- [x] tsc, eslint, vitest, the records check and the full web suite
      pass.
- [x] `CHANGELOG.md` lists the fix under 1.2.0.

## Outcome

Fixed on 2026-11-18 on `fix/month-pager-neighbour`.

The pager put a preview in a positioned box that took its height from
the track. The track holds only positioned children, so it has no
height. A month cell took its height from `aspectRatio: 1` over a
percentage width. In that subtree the width resolved and the height
came out 0. Every row was zero tall, so the dates stacked at the top
of the incoming card. The landed page sat in flow at the host's
width, so it came out right.

A preview now takes the host's measured width and height in pixels.
A month cell divides its row with `flex` instead of a percentage.

Emulator frame grids:

- 1.1.0 APK: the incoming card keeps its dates at the top until it
  lands (`android-20261118-113528`).
- This branch: the incoming card lays out on its first frame
  (`android-20261118-123853`).
- Week: no fault before or after.

The week pager has no twin. Its rows and grid carry fixed heights.

Gate: tsc, eslint, 1180 vitest tests, 612 e2e passed and 26 skipped,
record names, changelog, and Vale on the ADR.
