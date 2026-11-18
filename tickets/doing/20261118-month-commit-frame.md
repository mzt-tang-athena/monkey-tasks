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

- [x] A frame grid of a month swipe on the emulator shows no frame
      with paper in the card area.
- [x] The day and list pagers show the same.
- [x] The web suite's one-frame commit checks still pass.

## Outcome

The live page's place is back in React. Ticket 0087 carried it as a
plain style. PR 169 moved it into a shared value, where it landed a
frame after the content's native mount.

The live page rides the track's origin. The track carries its place
as a plain `left`, `live * width`, and the animated style reads only
the shared page position. A commit moves the place, the previews and
the content in one render. A drag stays on the UI thread, and a
landing has no frame between them.

The track's box stays over the host at rest, so Android keeps every
list tab's rows. The `uiautomator` dump puts `pager-track` and
`pager-live` at the pager's box, `[0,274][1080,2105]`, on a tab that
is not Main.

Before, on `30a2f4e`, every swipe showed one blank frame, 12 of 12
across the three pagers. After, none in 12 swipes. The strip already
named the new page in the blank frame, so the commit had landed.

Evidence: `app/build/verify/evidence/android-20261118-195734/` holds
the before grids. `android-20261118-202225/` and
`android-20261118-202843/` hold the after grids. ADR 0033 and 0046
record the shape.
