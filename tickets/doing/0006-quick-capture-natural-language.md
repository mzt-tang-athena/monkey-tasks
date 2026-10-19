---
id: 0006
title: Quick capture with natural language dates
created: 2026-10-19
priority: high
assignee: opencode
pr:
depends: [0002, 0004]
---

## Spec

A capture box in the app: type a line, get a task note in `Tasks/`.
Parsing is offline and deterministic, no LLM involved:

- chrono-node parses dates and times ("friday 4pm", "next week",
  "in 2 months"). The same library backs the Obsidian Natural Language
  Dates plugin.
- rrule.js parses recurrence ("repeat monthly") into a standard
  iCalendar RRULE string for `repeat`.
- Matched text is stripped from the typed line; the remainder becomes
  the task name and filename.

A line the parser cannot date still creates a task note with no `due`,
so capture never fails or blocks. A later athena agent may interpret
unparsed lines and write structured tasks back into the vault
(ADR 0003); that is out of scope here.

## Acceptance

- [ ] "call the dentist tuesday 3pm repeat monthly" creates a task
      named "call the dentist" with `due` and `repeat` set
- [ ] an undateable line still creates a task note
- [ ] parsing runs fully offline with airplane mode on
