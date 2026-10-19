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

- [x] "call the dentist tuesday 3pm repeat monthly" creates a task
      named "call the dentist" with `due` and `repeat` set
      (verified on device: due 2026-10-28T14:00, reminders set)
- [x] an undateable line still creates a task note
- [x] parsing runs fully offline with airplane mode on

## Outcome

Done, PR 5. `app/capture.ts` parses a typed line offline: chrono-node
for dates and times, keyword map and patterns for recurrence
("repeat monthly", "recurring monthly", "every Wednesday",
"every other day"), "remind me to" prefix stripped, matched text
removed, remainder is the task name. A typed time becomes a reminder
automatically. 9 tests cover it, including the acceptance example.

Device findings folded in during testing:

- SAF document URIs carry full relative paths in the last segment;
  name parsing fixed, so folder matching and the Notes list show
  short names.
- The app creates the `Tasks` folder itself when missing
  (SAF makeDirectoryAsync), so capture works on a fresh vault.
- Captured notes have an empty body: the filename is the task.
- The Tasks folder was missing on the phone because dotfile-only
  folders do not propagate through Obsidian sync; capture now
  self-heals instead of depending on a seeded folder.

Deferred: highlighting the parsed keywords in the capture box
(ticket 0008). Later: athena interprets undateable lines (ADR 0003).
