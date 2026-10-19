# Vault note vocabulary

The single contract for every client that reads or writes task notes:
the mobile app, Obsidian, vault agents, and a future MCP server on
athena. The Zod models in `src/vocabulary.ts` are the executable form
of this file. This document explains what each property means.

Rules that hold for all note types:

- The file name, without extension, is the note's title.
- Wikilink-valued properties are stored in their quoted form, for
  example `status: "[[active]]"`.
- Dates are `YYYY-MM-DD`. Datetimes are `YYYY-MM-DDTHH:MM`, seconds
  optional. No time zones; the phone's local time is the meaning.
- An absent property means the documented default. Nothing is required
  beyond `kind` and `created` on task and list notes.
- Properties the schemas do not know are preserved, never rejected, so
  notes keep whatever Obsidian plugins add.
- Anything the app or a query needs lives in the note. Filesystem
  metadata is a cache, never a source of truth.

## Task notes

One file per task in `Tasks/`. The filename is what the task is. The
body is optional free text, usually empty.

| Property | Form | Default when absent | Meaning |
|---|---|---|---|
| `kind` | `"[[tasks]]"` | required | the note type marker |
| `created` | date | required | the day the task was created |
| `completed` | date | open | present means done; the date is when |
| `due` | date or datetime | unscheduled | the day the task matters |
| `reminders` | datetimes | silent | when the phone buzzes; several allowed |
| `recurrence` | RRULE string | one-off | iCalendar recurrence for `due` |
| `lists` | wikilinks | unlisted | list notes this task belongs to |

Derived state: done means `completed` is present. Tasks carry no
`status` property.

Deferred until a consumer exists: `cancelled`, `categories`, `after`,
`updatedAt`, manual ordering inside a list, subtasks. See ticket 0004.

## Deed notes

One file per deed in `Deeds/`. Deeds are the longer, planned efforts,
with a real lifecycle.

| Property | Form | Default when absent | Meaning |
|---|---|---|---|
| `kind` | `"[[deeds]]"` | required | the note type marker |
| `status` | `"[[backlog]]"`, `"[[active]]"`, `"[[done]]"`, `"[[dropped]]"`, `"[[someday]]"` | not tracked individually | lifecycle stage |
| `parent deed` | wikilink | top-level | the deed this sub-deed belongs to |
| `categories` | wikilinks | uncategorized | waypoint links; what part of life this benefits |
| `types` | wikilinks | none | deprecated; tolerated until the 0005 migration |
| `after` | wikilinks | unblocked | each linked note must finish first |
| `created` | date | unknown | the day the deed was created |
| `due` | date or datetime | unscheduled | when the deed matters |
| `reminders` | datetimes | silent | when the phone buzzes; several allowed |
| `recurrence` | RRULE string | one-off | iCalendar recurrence for `due` |
| `completed` | date | not done | written when status reaches done |

Absent `status` is how sub-deeds work: they are tracked by their parent
deed, not by a lifecycle of their own.

Bare status values (`backlog` without brackets) exist in older notes.
The schema tolerates them by wrapping; the canonical form is the quoted
wikilink, and the migration in ticket 0005 rewrites the stragglers.

Free-form properties observed on individual deeds (`repo`, `pursuit`,
`estimate`, `tags`) are preserved as-is and not part of the vocabulary
unless they spread.

Derived state: done means `status` is `"[[done]]"`. The rename of
`after` to `blocked by` is ticket 0005; both names parse until then.

## List notes

One file per list in `Tasks/Lists/`. A list is a curated bucket of
tasks; a task belongs to a list through its `lists` property.

| Property | Form | Default when absent | Meaning |
|---|---|---|---|
| `kind` | `"[[lists]]"` | required | the note type marker |
| `created` | date | required | the day the list was created |

A list needs no other metadata yet. List notes earn properties of their
own (pinned order, icon, a waypoint) only when a feature asks for them.
