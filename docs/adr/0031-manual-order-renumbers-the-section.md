# 0031. Manual order renumbers the section

- **Status:** accepted
- **Date:** 2026-10-25

## Context

The Lists screen can sort by due time or by a manual order. A manual
order needs one number per task, and a drop must place a row between
two others. Two tasks can end up with the same number, and a dropped
row needs a value that sits between its new neighbours.

The alternatives were a fractional midpoint between the neighbours, or
a linked list of previous and next links. Fractions need a float
property and eventually collide or grow long tails. Links are
unreadable in Obsidian and break when one note is edited by hand.

## Decision

A drop renumbers the section's rows 1 to n and writes `order` only for
the tasks whose number changed. The number is an integer, written
unquoted, and the schema coerces the text the app's parser reads back
into a number. Sections keep their date grouping; the order applies
inside a section.

## Consequences

A drop can write several notes, one per moved row. A section is small,
and the writes run in sequence. The numbers stay short and readable,
and a hand edit in Obsidian can set one without arithmetic.

A task without `order` sorts after the ordered ones, by name. The
app's parser reads every scalar as text, so the vault check compares
`order` numerically instead of flagging the type.
