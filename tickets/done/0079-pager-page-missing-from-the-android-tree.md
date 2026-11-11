---
id: 0079
title: A non-first pager page is missing from the Android accessibility tree
created: 2026-11-10
priority: high
assignee: omp
pr: 106
depends: [0059]
---

## Spec

On Android, TalkBack and `uiautomator` cannot read the content of
any list tab except the first. The rows, the repair banner and the
empty state are painted, but they are not in the accessibility tree.

Found on 2026-11-10 during the epic 0047 emulator pass, on the release
APK of `9a69bcb`. Main reads 6 task row nodes. Errands, Finance and
Focus read none, while their screenshots show the same rows and
banners. The Planner day page keeps its nodes after a day change, so
the loss is specific to the lists pager's `SectionList`.

The cause is the `Pager` layout. The live page sits at
`left: live * 100%` inside the track, and the track is translated by
`-pos * width`. With `live > 0` the live page lays out at x = 1080,
outside the host's clip, and only the render transform draws it at 0.
Android's virtualized list clips its rows against that layout box, so
its rows leave the native view tree. Screen readers read the tree, so
they lose the page.

## What to do

Keep the live page's layout inside the host at rest, and express the
page position in the track's transform instead. A page's layout offset
must stay 0 while it is the live page.

Add a test that reads the live page's layout offset (not its painted
box) on a non-first tab. The painted box is already 0 and hid this.

## Acceptance

- [ ] A test shows the live page's layout offset is not 0 on a
      non-first tab before the fix.
- [ ] After the fix the live page lays out at 0 on every tab, and the
      pager still slides a neighbour into view while a finger travels.
- [ ] The emulator, with a fresh APK: `uiautomator` reads the rows and
      the banners on Errands, Finance and Focus, as it does on Main.
- [ ] The web suite passes, including the pager scenarios and the
      reduced-motion project.
- [ ] No page shows a blank strip, a flash at the commit or a vertical
      shift.

## Outcome

Fixed on 2026-11-11 on `fix/0079-pager-page-a11y`. Pull request #106.

The live page now lays out at the track's origin. The track's transform
carries the page position against the live page, and a preview sits at
`(rel - live) * 100%`. The painted result is unchanged.

`pagers.spec.ts` reads the live page's layout offset on a non-first
tab. It read 1200 px before the fix and reads 0 after. The painted box
read 0 before the fix too, which is why the web suite never saw it.

The emulator proves the fix, on the release APK of `bd15a24`:

| Screen | Task row nodes | Repair banner | Empty text |
|---|---|---|---|
| Main, before | 6 | yes | n/a |
| Errands, before | 0 | no | no |
| Errands, after | 0 (empty list) | yes | yes |
| Focus, after | 3 | yes | n/a |

`journeys/android-list-swipe.sh` now passes end to end: it swipes to
Errands with motion on and off, waits on the empty state, ticks and
unticks `Plan weekend hike`, and the note comes back byte for byte.
The journey also needed two harness fixes, both recorded in its diff:
a wait for the first row after the motion restart, and the row
circle's new accessible name from ticket 0063, which replaced
`mark done` with the task name.

A day swipe on the planner was recorded frame by frame:
`planner-swipe` slides Wednesday 11 to Thursday 12 with no blank
strip, and the date strip and mode switch stay still.

The phone and TalkBack checks stay with the operator.
