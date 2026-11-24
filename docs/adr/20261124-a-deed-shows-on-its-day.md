# A deed shows on its day, and a tick writes its status

- **Status:** accepted
- **Date:** 2026-11-24

## Context

Contracts ADR `20261124-deeds-are-tasks-with-a-status` makes a deed a
task with a status. Its child ticket `20261124-app-reads-deeds-as-tasks`
gets deeds into the app. The board ticket `20261124-deed-board`
follows.

That ADR decides Main. It leaves four things to the app. Where does a
deed show beside the planner? What does a tick write on a deed? What
does an untick write? What happens to a deed note with no status?

## Decision

- A deed shows in the planner, on its day, and rings its alarms. It
  never shows as a list row. Main and every list tab stay plain-task
  surfaces.
- A deed note with no status is a reference note. The app does not
  make it a row at all, so it shows nowhere and names nothing.
- A tick writes `completed` and `status: "[[done]]"` together, as the
  vocabulary says. An untick removes `completed` and writes
  `status: "[[backlog]]"`.
- The first app write of a deed note also writes the task kind. When
  the note has no `created` date, it writes one, because a task note
  needs it.

## Consequences

The 11 reference notes show nowhere until the vault tidy moves them to
`Notes/`. The app cannot open or edit them before that.

An untick cannot restore the status the deed held before the tick. The
note does not record it, and we added no field for it. Backlog is the
lowest claim, and the board's status picker sets the real value.

A deed that needs a list waits for the board. A list tab ignores it,
because one list is a plain-task bucket today.
