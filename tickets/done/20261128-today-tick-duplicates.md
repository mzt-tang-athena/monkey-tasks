---
title: A tick on Today leaves a stuck row on Main and duplicates notes
created: 2026-11-28
priority: high
assignee: omp
pr: PR
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

- [x] A tick on Today shows the task under Completed on its list.
- [x] Untick then tick leaves one note, plain task and repeat.
- [x] A repeat leaves exactly one next note after untick and tick.
- [x] Holds the same for every list, and for the Board's deeds.
- [x] A failing test lands before the fix, in both motion modes.
- [x] Proved on the emulator with a release-style build.

## Outcome
Cause: a tick on Today started a hold, and the row left Today at
once. No circle played, so nothing ended the hold. The hold stayed in
the screen's state. It then put the row back on Main, ticked and
struck through, in a group it had never been in.

Fix: the hold now drops any row the list no longer shows. Main and
every list tab get it, and so does the Board.

Proof: a web spec in both motion modes, a hook test, and an emulator
journey. The journey fails on the 1.4.0 build and passes on the fix.

Not reproduced: duplicate notes. Untick then tick wrote one note, and
one next note for a repeat, in every case tried. See the PR for the
cases, and for how to tell copies apart in the vault.
