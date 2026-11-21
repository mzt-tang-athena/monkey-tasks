---
title: Run motion-free specs once
created: 2026-11-19
priority: normal
assignee: omp
pr: 201
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
those in a single project. Keep both projects for every spec that
checks motion or its absence.

Measure first. Name what limits the wall time before you change it.

## Acceptance

- [x] Each spec carries a motion-dependent mark or not, with its reason.
- [x] Motion-free specs run in one project.
- [x] Wall time before and after, on the same host and load.
- [x] Every test still runs: the per-spec count matches, minus duplicates.

## Outcome

`app/e2e/motion.ts` marks all 30 specs: 17 `once` and 13 `both`, each
with a reason. The `reduced-motion` project skips the 17 by file name.
The suite refuses a spec with no mark, and a mark with no spec.
ADR 20261120-run-motion-free-specs-once.

The wall time follows the summed test time over two workers. On
2026-11-20 the tests summed to 2083 s. Two workers turn that into 1041
s. That accounts for 96 percent of the 1086 s the run took. The export
and the web server do not limit it. The run count does.

- Runs: 696 to 521. 175 duplicates gone, and no test lost.
- Motion project: 348 before and after, so each spec kept its tests.
- Wall time: 18.1 min to 12.9 min, 2 workers, same host and load.
- Skips: 27 before and after.

The pair ran back to back in one window. The host's load matched: two
workers, no other heavy job, and the verification emulator up from
09:37. Both runs went in place, because another lane's deadlocked gate
held the heavy lock. The PR explains that.

A lane can make one of the 17 specs check motion. That lane moves the
mark to `both` and pays for the second run.
