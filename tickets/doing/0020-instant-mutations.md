---
id: 0020
title: Make task mutations instant
created: 2026-10-22
priority: high
assignee: omp
pr:
depends: []
---

## Spec

Creating, completing, and uncompleting a task feels slow on the phone. The
cause is not the write. Every mutation awaits a full vault reload: list the
vault root, list the Tasks folder, read every note, parse it, replace the
whole list, then cancel every alarm and schedule every alarm again. The cost
grows with the vault, so it gets worse as the user adds tasks.

Make the local list the truth for the session and write the note behind it.

- Apply the change to the task list in the same frame as the tap.
- Write the note in the background. Do not reload the vault afterwards.
- Keep the reload for boot, pull to refresh, a new grant, and a return to
  the foreground.
- Chain consecutive taps on one note: the optimistic patch advances the
  note text with the same `updateProperty` the write uses, so the second
  tap builds on the first instead of overwriting it.
- Serialize writes per note uri. Two writes to one file must not interleave.
- Update only the touched task's alarms. The full rebuild stays on load.
- Revert the optimistic change and report `lastError` when the write fails.
- Capture inserts the task at once, then replaces the provisional uri with
  the real one from `createFileAsync`. A failed capture removes the item and
  keeps the sheet's draft.
- Memoize `TaskRow` so a one-row change re-renders one row.

## Acceptance

- [ ] A tick changes the row before any file I/O starts.
- [ ] A tick no longer reads any note from the vault.
- [ ] Two quick taps on one row end in the state the user expects.
- [ ] A failed write restores the row and shows the error.
- [ ] A capture appears in the list before its file exists.
- [ ] Ticking a task cancels only that task's alarms.
- [ ] The vault still wins on boot, on pull to refresh, and on foreground.

## Outcome

(filled in before moving to done/)
