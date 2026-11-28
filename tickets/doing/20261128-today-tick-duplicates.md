---
title: A tick on Today leaves a stuck row on Main and duplicates notes
created: 2026-11-28
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The operator hit this on the phone in 1.4.0. They tick a task on
Today. It leaves Today as it should. Its own list (Main) then shows
the task ticked and struck through in place, outside the
Completed group. They untick and tick it again. The task repeats,
and the vault fills with copies.

The bug has two symptoms, maybe one cause. Find it with runtime
evidence, on the web preview and then on the emulator. The fix must
hold for every source list and for the Board's deeds.

Leads, unconfirmed:

- `features/lists/lib/tick-hold.ts` holds a ticked row in place while
  its circle plays (ADR 0034). A hold started on Today may land on
  Main and never let go.
- Whether an untick of a repeat keeps or removes the next note, and
  whether a re-tick spawns another.

Do not touch the operator's vault. The report says how to tell the
copies apart.

## Acceptance

- [ ] A tick on Today shows the task under Completed on its list.
- [ ] Untick then tick leaves one note, plain task and repeat.
- [ ] A repeat leaves exactly one next note after untick and tick.
- [ ] Holds the same for every list, and for the Board's deeds.
- [ ] A failing test lands before the fix, in both motion modes.
- [ ] Proved on the emulator with a release-style build.

## Outcome
(filled in before moving to done/)
