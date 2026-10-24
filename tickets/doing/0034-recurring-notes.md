---
id: 0034
title: A recurring task completes, and the next one is a new note
created: 2026-10-23
priority: high
assignee: omp
pr:
depends: [0012, 0032, 0035]
---

## Spec

Today a tick on a recurring task moves its due date forward and never
shows as completed. That is the Todoist model. We want the Google
Tasks model: the occurrence completes, and a new note holds the next
one. See ADR 0027.

Google's help: "The next instance of your repeating task appears in
your task list on the date specified." The list hides it until then;
the calendar shows it. We copy that split: the Lists screen hides it,
the planner shows it.

The vault has one file per task, so the new note needs a unique name.
It is `<title> <YYYY-MM-DD>.md`, with `title` holding the display name
and `recurrence previous` linking the completed note.

## Acceptance

- [ ] Ticking a recurring task writes `completed` on that note and
      leaves its due date unchanged.
- [ ] A new note holds the next date from the original schedule, with
      the same body, lists and reminders.
- [ ] The new note's name is `<title> <YYYY-MM-DD>.md`, `title` is the
      display name, and `recurrence previous` names the completed note.
- [ ] A name collision takes a numeric suffix.
- [ ] The Lists screen hides the new note until the start of its due
      day. The planner shows it on that day.
- [ ] A next date already in the past shows immediately.
- [ ] A rule with UNTIL or COUNT creates no note once it is exhausted.
- [ ] A failed create leaves the old note untouched and reports it.
- [ ] A failed completion deletes the new note and reports it.
- [ ] Unticking clears `completed`. If the new note is still the text
      we created, it is deleted. If it was edited or completed, both
      notes stay and the app says so.
- [ ] The editor shows `title` when present. Renaming a titled note
      updates `title`, not the file.

## Outcome

(filled in before moving to done/)
