# The Today list is a built-in list

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Lists draws Main and then one tab per list note. Main holds the
unfiled tasks. The operator asked for a Today list, switched in
Settings. A Kanban list follows in its own ticket.

Today must not write a `list` value, so the vault needs no schema
change. It shows tasks rather than owning them. The same task can sit
on a list tab and on Today.

The planner already answers which day a task belongs to. `occursOn`
counts a task on a day when its due date falls there. It also counts an
open task's recurrence occurrence on that day.

## Decision

We made Today a built-in list that sits beside Main. It opens first,
before Main. Settings gains a Built-in lists section that switches it
on and off, and it starts on.

Today holds the open tasks the planner's day rule puts on today. It
also holds the overdue ones, in a Past group above them. A tick leaves
the tab. A reminder alone does not count: the due date decides.
Capture from Today dates the task today.

When Today is off, the tabs run Main first. A fresh start lands on the
first tab, so it lands on Today while Today is on.

We rejected a list note named Today. A note would need a schema value,
and the user could delete it. Its tab would be a list rather than a day
view. We rejected a separate reminder rule, because the planner's day
rule is the one membership rule in the app.

## Consequences

A task with no due date never shows on Today. That is the point, and
Main still holds the undated ones.

A list note named Today never gets a tab. Main behaves the same way
today.

Today is a date view. Its rows keep the Past and Today groups in every
sort setting, and a drag never reorders them.

The e2e suite now lands on Today. A spec about Main asks for Main
first. That edit is part of this ticket, because the default tab is a
real change on the screen.
