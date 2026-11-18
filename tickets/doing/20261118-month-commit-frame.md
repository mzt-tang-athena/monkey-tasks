---
title: The month card blinks at the landing
created: 2026-11-18
priority: normal
assignee: omp
pr:
depends: []
---

## Spec

A month swipe on the phone lays the incoming card out correctly now
(ticket 20261118-month-pager-neighbour). At the landing, one frame
shows paper where the card sits. The next frame shows the landed
card.

Seen once in a frame grid of a month swipe.
That run was the release APK of `839087b` on the Pixel 7 emulator.
The 1.1.0 run did not capture the frame.
The web suite checks that a month swipe swaps the page and its place
in one frame. That check passes, so this is native only, or timing.

The pager sets the live page's offset from `liveAt` in a layout
effect. `pos` catches up in a separate animated reaction. For the
frame between them the live page stands one page over.
The preview for that page has already unmounted, so the host shows
its paper.

Ticket 0087 fixed this shape once with a plain style for the live
offset. PR 169 moved the page position onto a shared value. Check
whether the gap came back with it.

## Acceptance

- [ ] A frame grid of a month swipe on the emulator shows no frame
      with paper in the card area.
- [ ] The day and list pagers show the same.
- [ ] The web suite's one-frame commit checks still pass.

## Outcome
