# 0027. A recurring occurrence is an immutable note

- **Status:** accepted
- **Date:** 2026-10-24

## Context

A tick on a recurring task moved its due date forward. Todoist, TickTick
and Microsoft To Do work that way: one live task, history kept
elsewhere. Google Tasks, Obsidian Tasks and Things 3 create a new
occurrence and keep the completed one. Google's help states that the
next instance appears in the task list on its due date.

The vault has one file per task and no stable id. Two occurrences
cannot share a file name, and Obsidian resolves links by name.

## Decision

A completed occurrence is never rewritten. The tick writes
`completed` on that note and leaves its due date alone. A new note
holds the next occurrence.

The new note is named `<title> <YYYY-MM-DD>.md`, carries
`title: <display name>`, and carries
`recurrence previous: "[[<completed note>]]"`. The date comes from the
original schedule, not the completion day. The body, lists and
reminders are copied.

The Lists screen hides a note that has `recurrence previous` and a due
date after today. The planner shows it, because the planner is the
calendar surface. The rule is derived on read, so no hidden flag and
no background job.

We rejected a UUID property. It does not fix the file name, and
Obsidian cannot resolve it to a file.

## Consequences

A completion is two file writes: create the new note, then complete the
old one. If the second fails, we delete the new note. If the delete
also fails, two open occurrences remain, and the repair block shows
them. A failure can leave a visible duplicate, never a lost series.

Unticking clears `completed` first. If the new note is still the text
we created, we delete it. If it was edited or completed, we leave both
and say so.

The editor shows `title` when present. Renaming a titled note changes
the title, not the file, because the file name is an address.

A series has no id. Its occurrences form a chain, so grouping the
whole series means walking `recurrence previous`. We accept that until
a feature needs more.
