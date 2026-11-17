---
title: The pager hides list rows from TalkBack again
created: 2026-11-17
priority: high
assignee:
pr:
depends: []
---

## Spec

Ticket 0079 fixed a bug where a list tab other than Main lost its rows
from the Android accessibility tree. TalkBack and `uiautomator` saw an
empty list, while the screen drew every row.

The bug is back on main at `1f5cd75`. The 0093 emulator pass found it
on 2026-11-17, with the release APK. After a tab switch, the dumper
logs `Skipping invisible child ... pager-track ... Rect(0, 274 - -1080,
2157) ... visible: false`. The dump then holds no `task-row` nodes.
Main still shows its rows. Finance and Focus show none, even after an
app restart.

Ticket 0087 (PR 110) brought it back. It moved the page position into
the track's transform, `-pos * width`, and shifted the live page back
by `live * width`. The live page paints at x = 0, but the track itself
now sits off screen. Android skips the whole track as invisible.

Evidence sits in
`app/build/verify/evidence/android-20261117-024249/` of the
`lane-editor` checkout: `finance-tab-now.txt`, `focus-tab.txt` and
`finance-after-restart.txt` hold 0 rows, and `main-restart.txt` holds
5.

## What to do

Keep both rules at once:

- From 0079, the live page and the track it sits in stay inside the
  host at rest.
- From 0087, a commit swaps the live page's content and its place in
  the same frame, with no blank strip.

Add a test that fails on main today. Read the track's layout and
transform at rest on a non-first tab, not only the live page's painted
box.

## Acceptance

- [ ] On the emulator, every list tab's rows show in the
      `uiautomator` dump after a tab tap and after an app restart.
- [ ] The 0087 frame check still passes, with no blank strip on a
      swipe.
- [ ] A unit or e2e test fails on `1f5cd75` and passes with the fix.

## Outcome

(filled in before moving to done/)
