---
title: A reminder offers "didn't do"
created: 2026-11-25
priority: low
assignee:
pr:
depends: [20261125-reminder-actions-done-and-reschedule]
---

## Spec

The operator's feedback on 2026-11-25. Later on, a reminder gets an
archive or "didn't do" button, beside Done and Reschedule.

The vault has no "didn't do" state for a task today. A deed has
`status: dropped` since contracts ADR
`20261124-deeds-are-tasks-with-a-status`. Decide with the operator
what a skip writes. A skipped task could take that status. A skipped
occurrence of a repeating task could be its own record.

## Acceptance

- [ ] The operator picks what "didn't do" writes.
- [ ] The button writes it from the notification with the app killed.

## Outcome

(filled in before moving to done/)
