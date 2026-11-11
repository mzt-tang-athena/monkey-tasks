# One list per task, and order is the whole tab

- **Status:** accepted
- **Date:** 2026-11-11

## Context

A task note can carry `lists`, a list of wikilinks. Main shows every
task. Each list note gets a tab.

`order` is an integer the reorder writes. Today it only ranks rows
inside a date section.

One task with two lists needs two ranks. A single `order` cannot hold
both. The vault has 8 task notes, and none carry `lists` or `order`. A
change is cheap now.

## Decision

A task belongs to one list. The note carries `list: [[Focus]]`, one
wikilink. The parser still reads the old `lists` field and takes its
first link. The app writes the singular field.

Main holds the tasks with no list. It is no longer a catch-all.
Capture into Main writes no `list`.

`order` is the position of a task in its whole tab. In My order a tab
is one flat list, and a drop can land anywhere in it. A drop renumbers
the tab 1 to n. The Due sort keeps its date sections, and `order` does
not apply there.

We rejected many lists. It needs a rank per list for every tab that
shows the task. The only use case we found, subtasks built from lists,
is not needed yet.

## Consequences

One number per task has one meaning, because a task sits in one tab. A
drag never writes a number that another tab reads differently.

A task that fits two contexts is copied, or it keeps one list and gains
a reference link in its body. There is no second copy, so completion,
recurrence and reminders cannot drift between two notes.

Main becomes a queue to file from. A task leaves Main the moment it
gets a list, and returns when the list is removed.

The date sections stay under the Due sort. My order no longer groups by
date.

The editor needs a single picker. Ticket 0093 rebuilds it, and the
picker lands inside that rebuild.

## Migration

No note in the live vault carries `lists` or `order`, so no bulk
rewrite.

A note with two links resolves to its first link. The app does not
rewrite it. The next save of that task writes `list` and drops the
extra links, so the tab shows the list the user kept.

Existing `order` numbers were written inside a section, so one tab can
hold duplicates. The My order sort breaks a tie by `created`, then by
name. The first drop in that tab renumbers it 1 to n. Until that drop,
nothing is written.
