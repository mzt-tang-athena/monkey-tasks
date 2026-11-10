---
id: 0079
title: A non-first pager page is missing from the Android accessibility tree
created: 2026-11-10
priority: high
assignee:
pr:
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

(filled in before moving to done/)
