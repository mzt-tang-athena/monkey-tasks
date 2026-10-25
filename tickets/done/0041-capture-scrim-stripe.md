---
id: 0041
title: The capture scrim leaves a bright stripe at the top
created: 2026-10-25
priority: normal
assignee: omp
pr: 60
depends: [0038]
---

## Spec

Reported on the phone after 0038. Opening capture dims the page but a
band across the top stays bright: the status strip and the tab strip
keep the paper color.

The scrim is placed from the bar's own box: its height is the window
less the bar, and its bottom animates to 0 when capture opens. Height
and bottom then cancel, so the scrim's top edge sits one bar height
below the window top instead of at it.

The scrim covers the whole window. The bottom offset alone clears the
navbar while it slides away.

## Acceptance

- [ ] With capture open, the scrim covers the status strip and the tab
      strip. No bright band remains at the top.
- [ ] With capture closed, nothing is dimmed.
- [ ] The navbar still clears the scrim as it slides away.

## Outcome

The scrim's height was the window less the bar, and its bottom
animated to 0, so its top edge landed one bar height below the window
top. The height is now the full window. The bottom offset alone clears
the navbar as it slides away, and the scrim reaches the status strip.

Verified in the web preview at 390 by 800 and 320 by 640: opening
capture dims the tab strip and the status strip with the rest of the
page, and closing restores it. No bright band remains.
