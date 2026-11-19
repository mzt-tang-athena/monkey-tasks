---
title: Run motion-free specs once
created: 2026-11-19
priority: normal
assignee:
pr:
depends: []
---

## Spec

The web suite runs every spec twice, as `motion` and `reduced-motion`.
That makes 670 runs, about 17 minutes on 2 workers. The run holds the
heavy lock the whole time, so every lane waits on it.

The slowest specs on 2026-11-19, summed over both projects:

| Spec | Seconds |
| --- | --- |
| a11y | 196 |
| gallery | 182 |
| pagers | 181 |
| planner-drag | 168 |
| theme | 154 |

Some specs check nothing that motion changes. Find which ones, and run
those in one project only. Keep both projects for every spec that
checks motion or its absence.

Measure first. Name what limits the wall time before you change it.

## Acceptance

- [ ] Each spec carries a motion-dependent mark or not, with its reason.
- [ ] Motion-free specs run in one project.
- [ ] Wall time before and after, on the same host and load.
- [ ] Every test still runs: the per-spec count matches, minus duplicates.

## Outcome

(filled in before moving to done/)
