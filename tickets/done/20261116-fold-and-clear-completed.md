---
title: Fold completed tasks and clear them
created: 2026-11-16
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The operator wants monkey-tasks 1.0 this week. Done tasks take a whole
group on every list tab, so they crowd the work that is still open. They
should sit folded under a Completed header by default. The list's
overflow menu should offer "Delete all completed tasks" for the tab.

### Fold

- The Completed group starts folded on every tab, Main included. It
  folds again when the app restarts.
- The header keeps the group's count and adds a chevron. The header is a
  44pt target with `aria-expanded`. A tap opens or closes the group.
- Folding leaves the rest alone. Reorder looks up the full group, and
  the tick holds its row for the wash. The "only completed" empty state
  still shows, and the pager preview draws the same folded page.
- The open and close fit the existing motion system. The chevron turns
  on the shared `useProgress` clock and the touch target keeps its size.
  The rows live in a `SectionList`, so they change with the data.

The fold is session state, per tab, like the selected tab. The reason
and the rejected alternative go in the ADR.

### Delete all completed tasks

- Show the item in the list overflow menu on a tab that has completed
  tasks. Leave it out when the tab has none, as the menu leaves out
  every item it does not need.
- Act on the current tab's completed tasks only. Snapshot them when the
  menu item opens the confirmation, so the count and the deleted notes
  are the same set.
- A `Sheet` asks first: "Delete 4 completed tasks? This removes their
  notes from the vault." The confirm uses the danger tone. Cancel is
  the safe default: it holds the first focus and Escape closes the
  sheet.
- Delete one note per task through the existing mutation layer. The
  rows leave at once. A failed note comes back and the notice names how
  many stayed. When every delete fails, the write fails like any other
  write, with the failure banner and Retry. A finished write reads the
  vault again.
- Say how a deleted note behaves with Obsidian sync. Do not build undo.
  The mutation layer rolls back a failed write only, and keeps no
  history of a write that landed.

## Acceptance

- [ ] Completed starts folded on every tab, with its count and chevron,
      and toggles through a 44pt target with `aria-expanded`.
- [ ] The open state is per tab and does not survive a restart, and the
      ADR says why.
- [ ] Reorder, the tick hold, the only-completed empty state and the
      pager preview still work with the fold.
- [ ] The overflow menu shows Delete all completed tasks only when the
      tab has completed tasks. It acts on that tab alone.
- [ ] The confirmation names the count, uses the danger tone, and
      Cancel changes nothing.
- [ ] A partial delete failure restores the notes that stayed and
      reports their count. A total failure rolls back and lists a Retry.
- [ ] Component tests cover the fold default and toggle, and the clear
      count and tab scoping. The mutation test covers a partial failure.
- [ ] Web e2e covers fold default, open and close, the menu item,
      Cancel, and a confirm. The confirm removes exactly that tab's
      completed notes from the sample vault.
- [ ] Evidence sits under `app/build/verify/evidence/fold-completed/`.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e --max-warnings 0`,
      `npx vitest run` and the e2e pass. No new CI job.
- [ ] The ADR records the fold persistence, the delete and the scope.
      README says what the Lists screen does now.

## Outcome

(filled in before moving to done/)
