---
title: Draw the edge where content scrolls under a header
created: 2026-11-19
priority: normal
assignee: omp
pr:
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
