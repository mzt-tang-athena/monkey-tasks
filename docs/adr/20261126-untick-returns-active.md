# An un-ticked deed returns to Active

- **Status:** accepted
- **Date:** 2026-11-26

## Context

A tick writes status done and a `completed` date. The note keeps no
record of the status the deed held before. The app reopened a deed as
Backlog. A Someday deed moved to Backlog after a tick and an un-tick.
Nobody chose that move.

## Decision

An un-tick returns a deed to Active. A plain task with no status stays
plain. The Board's drag out of Done and the editor's status picker keep
writing the status the user picked.

We rejected two options.

- **Remember the old status.** It needs a new property in the vault,
  which means a contract change, for a rare case.
- **Keep Backlog.** It moves Someday deeds and hides a deed the user
  just reopened behind the open work.

## Consequences

A reopened deed shows at the top of the Board, where the user is
looking. A Someday deed ticked by mistake lands in Active, not back in
Someday, and the user drags it back. The contracts ADR
`20261124-deeds-are-tasks-with-a-status` names no reopen status, so
the vault contract does not change.
