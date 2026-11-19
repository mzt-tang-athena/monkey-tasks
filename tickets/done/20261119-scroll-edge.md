---
title: Draw the edge where content scrolls under a header
created: 2026-11-19
priority: normal
assignee: omp
pr: 181
depends: []
---

## Spec

Three screens scroll content under a fixed header with no edge.
The day's hours meet the TIMELINE label.
The Inbox cards meet the Inbox Notes title.
The Settings sections meet the Back row.

The audit of the 1.0 screenshots found five spots.
The operator left the Lists tabs and the Journal band alone, because
each already carries its own rule.
The other three get a hairline.

The timeline shows its line only once hours pass under the header.
The Inbox and Settings show theirs always.

Use the existing hairline colour and width.
One shared piece draws all three.
The on-scroll rule follows the scroll on the UI thread, so no frame
re-renders the screen.
Reduced motion shows the line at once, with no fade.
Every line takes the active palette.

## Acceptance

- [ ] One shared piece draws the three edges.
- [ ] The timeline line waits for content to pass under it.
- [ ] The Inbox and Settings lines always show.
- [ ] A scroll frame re-renders no screen.
- [ ] Reduced motion shows the line at once.
- [ ] Each line takes the hairline of each palette.
- [ ] The web e2e holds the three edges in light and dark.
- [ ] Emulator shots show the three edges in light and dark.

## Outcome

Shipped in #181. One `ScrollEdge` piece draws all three lines.

The line sits on the scroller's top edge and takes the palette
hairline. It draws no rule for a day at its top, because it follows
the scroller's offset on the UI thread.

Gate on `0fcedb6`: tsc, eslint with `--max-warnings 0`, 1205 vitest
tests and Vale all pass. `check-records.sh` and `check-changelog.sh`
pass. The full web suite: 642 passed, 26 skipped.

`scroll-edge.spec.ts` holds the three edges in both projects, so
motion and reduced motion each pass. The component test scrolls a
`MotionScrollView` and reads its line with one render.

Web shots at 412 and 360 in Budget and Midnight:
`app/build/verify/evidence/20261119-031342/`.

Release APK `6392e5e8` (swap) on the Pixel 7 AVD, both palettes:
`app/build/verify/evidence/android-20261119-034633/` and
`android-20261119-035117/`. The timeline shows no line at its top and
one once hours pass under the header. The Inbox and Settings lines
show in both palettes.
