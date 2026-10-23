---
id: 0034
title: A recurring task completes, and the next one is a new note
created: 2026-10-23
priority: high
assignee:
pr:
depends: [0012]
---

## Spec

Today a tick on a recurring task moves its due date forward and never
shows as completed. Visually that reads as the task hopping, not
finishing.

The wanted shape, from Google Tasks:

- The ticked note gets `completed` and stays completed.
- A new note for the next occurrence is created, so the history is
  immutable: the old note is never rewritten after it completes.
- The next occurrence does not reappear on the list until the day it is
  due.

That last rule is the "hide until the next day" behaviour. Its exact
timing is open.

Data consequence: completing a recurring task writes one new file and
one property on the old file. It is not a single property edit.

## Acceptance

- [ ] Ticking a recurring task marks that note completed.
- [ ] A new note exists for the next occurrence, with the same
      recurrence, lists and reminders shape.
- [ ] The completed note keeps its original due date.
- [ ] The new note does not show on the list before its due day.
- [ ] A failed create leaves the old note untouched and reports it.

## Outcome

(filled in before moving to done/)
