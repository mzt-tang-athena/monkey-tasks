---
title: A due move compares moments, not strings
created: 2026-11-27
priority: low
assignee:
pr:
depends: []
---

## Spec

Since PR #261, `reconcileTask` in `reminder-sync.ts` dismisses a
task's tray reminder when its due moves. It compares the raw `due`
strings. Today every write keeps the string as written, so a
string-only change can't happen.

A future path that rewrites the string without moving the moment
would dismiss a live reminder. An example is one that trims the
seconds, which `parseStoredDate` accepts and ignores.

- Compare the parsed moments, not the strings.
- Keep a due cleared to none as a move.

## Acceptance

- [ ] A rewrite of the same moment keeps the tray reminder.
- [ ] A real move still dismisses it, tested.

## Outcome

(filled in before moving to done/)
