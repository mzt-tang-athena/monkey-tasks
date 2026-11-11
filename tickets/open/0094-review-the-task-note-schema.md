---
id: 0094
title: Review the task note schema
created: 2026-11-11
priority: high
assignee:
pr:
depends: []
---

## Spec

The task note carries ten fields. Some are underused. Some have a
shape that will not serve the dashboard the operator wants. This is a
review. No app code ships from it.

The fields today, as `contracts/packages/schemas/src/vocabulary.ts`
defines them:

| Field | Shape | Read by |
|---|---|---|
| `kind` | `"[[tasks]]"` | parser, editor |
| `title` | string | display name when the file name differs |
| `order` | int | manual sort, reorder |
| `created` | date or datetime | sort fallback |
| `completed` | date | done state, sections |
| `due` | date or datetime | sections, planner, timeline |
| `reminders` | datetime list | notifications only |
| `recurrence` | RRULE | row badge, spawn, next due |
| `recurrence previous` | wikilink | hide future occurrences, reopen |
| `lists` | wikilink list | tab filter |

The body is free markdown. It holds the note and, from ticket 0091, the
`## Reference` links.

Evidence, measured on 2026-11-11. `/home/monkey/vault/main/Tasks` holds
8 task notes and 1 list note. All 8 use `kind`, `created` and `due`.
None use `title`, `order`, `reminders`, `recurrence` or `lists`. The
app is ahead of the vault, so absence is not proof a field is useless.

Decisions to settle:

1. `completed` holds a date. A dashboard cannot tell when in the day a
   task was done. Accept a datetime, write one, keep old dates valid.
2. `kind` is a wikilink, while the vault's own conventions use plain
   strings (`task`, `project`, `resource`). Accept both, and do not add
   more wikilink kinds.
3. A timed `due` does not ring. Only `reminders` rings. That is a trap.
   Decide whether a timed due rings by itself, with `reminders` for
   extra alerts.
4. `order` is a rank inside a date section, not a global order. The
   name says otherwise. Document it, or make the reorder write the
   whole tab.
5. `lists` is many-to-many, and Main shows every task. Keep it. The
   editor should turn the newline field into a picker, which ticket
   0093 covers.
6. `title` exists for a file-name collision. Keep it and say so.
7. `priority` does not exist. Add `priority: 1..4` only if the editor
   rebuild wants Todoist's P1 to P4.
8. Subtasks do not exist. Adding `parent` is a schema and UI change.
   Do not add it without a product decision.
9. Deeds are a contracts type the app never reads. Leave them out of
   the app.
10. The app sees `Tasks/` only, 8 notes of a much larger vault. The
    journal and references add two folders. A dashboard is a new read
    model, not a task field.

Deliverable: an ADR with the accepted changes and a migration note.
Split the code into child tickets. Never rewrite the vault in bulk.

## Decisions

The operator answered on 2026-11-11.

- `completed` gets a time. Accept a datetime, write a local timestamp,
  and keep old dates valid. `created` gets the same treatment. The app
  already writes a datetime for `created`; keep old dates valid.
- A timed `due` rings. `reminders` holds extra alerts. The weight of a
  reminder is in `20261111-reminder-weight`.
- `kind`. Accept both shapes in the parser, and always write the link
  form from the app. No new wikilink kinds.
- `title`. Keep it and document why it exists.
- Deeds. Do not leave them out. They should integrate with tasks, and
  perhaps dissolve into them. Spike `20261111-deeds-into-tasks`.
- Priority. No vague low, medium or high. The need versus dismissible
  idea is not that field. It is discussed in
  `20261111-reminder-weight`.
- Subtasks. No `parent` now. If they appear later, build them from
  lists and references, not a new field today.
- References. No extra rules for a proper reference yet. Revisit when
  a case needs detection.
- `lists` and `order`. One list or many, and what order means, is in
  `20261111-list-membership-and-order`.

## Acceptance

- [ ] Every field has a verdict: keep, change, remove or add.
- [ ] An ADR records the accepted changes and the rejected ones.
- [ ] The parser still reads every old shape, with a fixture for each.
- [ ] Each accepted change is a child ticket with its own migration.
- [ ] The three discussion tickets are decided or dropped.
- [ ] No bulk rewrite of the vault.

## Outcome

(filled in before moving to done/)
