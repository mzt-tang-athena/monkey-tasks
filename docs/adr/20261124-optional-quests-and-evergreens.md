# A flag on the task note marks quests and evergreens

- **Status:** proposed
- **Date:** 2026-11-24

## Context

The operator wants two new things in the planner. An optional
quest is an event they could join, such as figure drawing. An
evergreen is a practice they always want to do, such as reading.
The operator may do either, and nothing breaks if they skip it.

Today the app has one kind of task, and every task is a commitment. We
seeded quests and evergreens as plain tasks in the web preview.
Quests went overdue, filled the week's chip slots, and dotted
every month cell. A drag of an evergreen onto a day wrote a due
date onto it. It then left the pool after one use.

The vault is data with a schema contract. A new property or a
new kind changes `contracts/packages/schemas` first. Ticket 0092
holds the findings, the mockups and the open questions.

## Decision

We propose one boolean property, `optional`, on a task note. A
quest is an optional note with a `due`. An evergreen is an
optional note with no `due`. An optional note never goes overdue
and never rings unless it has `reminders`. It draws as an
outline, where an owed task draws filled.

A drag of an evergreen onto a day leaves the evergreen alone. It
creates a new owed note for that day, named as ADR 0027 names an
occurrence, with `From [[<evergreen>]]` in its body.

We considered two other shapes:

- New kinds, `[[quests]]` and `[[evergreens]]`, in a new folder.
  The model is cleaner, but every task feature would need a twin.
- Two named lists, `Quests` and `Evergreen`, with no schema
  change. It costs least, but the meaning hangs on a list name,
  and a quest could not sit in another list.

## Consequences

The contract grows by one property. The editor, capture, drag
and recurrence code serve optional notes as they are. The Lists
screen shows optional notes in their list, without the overdue
mark.

The tick path changes for optional recurring notes. A skipped
quest keeps an old `due`, so a tick first moves `due` to the day
ticked, then spawns the next occurrence.

Each evergreen drop adds a note to the vault. That is the price
of a history: Obsidian backlinks on the evergreen list each dated
note it spawned.

The status stays proposed until the operator picks a shape in
ticket 0092.
