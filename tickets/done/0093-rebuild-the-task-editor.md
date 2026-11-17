---
id: 0093
title: Rebuild the task editor
created: 2026-11-11
priority: high
assignee: opencode
pr: 155
depends: [0082, 0091]
---

## Spec

The operator says the task editor <!-- vale off -->"absolutely sucks"<!-- vale on -->.
They want it rebuilt, and they named Todoist's task view as the
reference.
The design session will settle which exact parts they like.

Today the editor is six text fields in a column, from
`app/src/features/task-editor/components/task-editor-form.tsx`: Name,
Due, Recurrence, Lists, Reminders and Body. Due and reminders ask for
ISO text. Recurrence asks for an RRULE string such as `FREQ=WEEKLY`.
Lists ask for newline-separated names. The screen has no picker and no
preview of what a value means. No property changes in one tap.

This is a discovery and design ticket. No app code ships from it.

Questions the session must answer:

1. Properties. Due, time, recurrence, list, reminders, reference
   (ticket 0091), note body, delete. Which are v1, and what is the
   order on the screen?
2. Raw syntax. Which values get a picker, and where does the escape
   hatch live for an RRULE or a hand-written date?
3. Save model. A save button, or write on each change through the
   existing mutation layer? What happens when a write fails?
4. Layout. Todoist puts the title and note first, then a row of chips,
   then the rest. Is that the shape, a sheet, or a split?
5. Keyboard. What stays above the keyboard, and what closes it?
6. Subtasks. The vault has no subtask type. Say no, or propose one.
7. The note body. Plain markdown editing, or a read view with a
   separate edit step?
8. Delete and undo. Where do they live, and what does undo restore?

Deliver a spec in this ticket. Add three mockups of the same task: a
due date, a list, a reminder, a reference and a note. Add a web
prototype of the chosen direction. Then split the build into child tickets. Write
an ADR if a real alternative stays open.

## Design

The design session settled this on 2026-11-11. The operator's reference
is Todoist's task sheet.

### Shape

The editor is a bottom sheet that opens over the
screen that shows the task. `app/src/components/ui/sheet.tsx` already has
the scrim, Android back and the keyboard ride (ADR 0014).

Note 2026-11-17: this spec first said the sheet already had drag to
dismiss. It did not. The drag shipped after PR 155. A drag down on the
sheet's handle or on a header row now closes it. ADR
`20261116-task-editor-sheet` records how the drag shares touches.

From top to bottom:

1. A header row. The linked list with a chevron on the left, a three-dot
   menu on the right.
2. The title. Multiline and always visible.
3. A grid of tiles, two per row, one tile per property that has a
   value. A tap opens that property's picker. Note takes the full width
   and shows its first two lines.
4. The add strip: a horizontal row of chips for the properties that
   have no value. Reminder and Reference stay in the strip, because a
   task can hold more than one.
5. The note body stays hidden until a tap on its tile or chip.

Every tile and chip shows an icon and plain words, such as "25 Oct" or
"Every Monday". Raw ISO text and RRULE text never appear.

The operator saw three mockups on 2026-11-14. A put set values in rows
above an add strip. B put every value in one strip of chips. C was a
fixed grid of tiles. They picked C, then on 2026-11-16 chose a hybrid. Set values get tiles and
unset ones stay in the strip, so a bare task shows a short sheet.

### Properties (question 1)

| Property | Control | Stored as |
| --- | --- | --- |
| Title | Multiline text, always visible | File name |
| Due | Date sheet: Today, Tomorrow, Next week chips, a month grid, then a time row | `due`, a date or a datetime |
| Recurrence | Presets: Daily, Weekly, Monthly, Yearly, Weekdays. Advanced opens an RRULE field | `recurrence` |
| List | The header control. A searchable single picker of list notes, with Main for none | `list`, one wikilink |
| Reminders | Any number of date and time entries, with add and remove. One Harsh or Quiet control for the whole task | `reminders` and `alert weight` |
| Reference | The picker from ticket 0091 | `## Reference` in the body |
| Note | A full editor over the sheet | Body text |
| Delete | The three-dot menu | The app removes the file |

Tiles and chips keep this order: Due, Repeat, Alerts, Reference, Note.
List lives in the header and Delete in the menu, so neither gets a tile
or a chip. The Alerts tile holds the reminders and the
weight, and shows the timed due as "at due".

A task has one list. ADR `20261111-one-list-and-tab-order` decided that
on 2026-11-11. The header shows Main when the task has no list.

A task can hold any number of reminders. The weight from ADR
`20261111-reminder-weight` covers the timed due and every reminder, so
the editor shows it once per task.

### Raw syntax (question 2)

No raw text sits in the main path. Recurrence keeps one escape hatch:
Advanced takes an RRULE and shows the next three dates as plain words.
The date field has no free text, so hand written dates leave v1. Lists,
reminders and reference use pickers only.

### Save model (question 3)

Every change writes through the existing mutation layer. The sheet has
no Save button and no Cancel button. Closing the sheet does not cancel a write in
flight.

A failed write keeps the new value on screen. A retry row at the top of
the sheet says "Not saved. Retry". Retry repeats the same edit against
the latest file text. If the file changed on disk, the row says so and
keeps the draft.

The draft hook serializes writes for one task, so quick taps queue up.
The last value for a property wins.

### Layout (question 4)

The sheet is the layout. It covers the lower part of the screen and keeps
the list visible above it, as in the reference. A longer task scrolls
inside the sheet. The editor has no split view and no route of its own.

### Keyboard (question 5)

The sheet rides the keyboard. The title stays above it. The tiles
scroll. A scrim tap, Android back or a drag down on the handle or the
header dismisses the sheet. The note editor has its own Done control in its header.

### Subtasks (question 6)

No subtasks in v1. The vault has one note per task today. A child note
needs a new link property, a child row and a child UI. Revisit this when
the operator asks for it.

### Note body (question 7)

The Note tile or chip opens a full height markdown editor over the sheet.
The text is plain markdown, with no preview toggle in v1. Back returns to
the sheet and the text is already saved. Once a note exists, its row
shows the first line.

### Delete and undo (question 8)

Delete sits in the three-dot menu. The sheet closes and a toast says
"Task deleted" with Undo for five seconds. Undo writes the exact original
file text back to the same path. When the toast expires, the app drops
the text. The vault has no trash, so Delete without Undo is permanent.

When the restore write fails, a toast says the app could not restore
the task.

### Reference

Ticket 0091 governs the picker, the body section and the read sheet.

### Out of v1

Priority, subtasks, comments, a configurable strip, natural language in
the title, hand written dates and a note preview toggle.

### Build split

On 2026-11-16 the operator asked for the build to ship from this ticket
for the 1.0 release. One owner builds it on this branch. Reference has
its own groundwork, so it stays out. It waits for ticket 0091, and the
strip gets its chip then.

Alert weight is in. The `20261111-alert-weight-*` tickets landed on
main first. The Alerts picker holds the Harsh and Quiet control under
the reminders. The Alerts tile says Quiet when the task is quiet.

The list picker from ticket `20261111-single-list-picker` lands here.

## Acceptance

- [x] The spec names every property, its control and the save model.
- [x] Three directions show the same task, and the operator chooses
      one.
- [x] The prototype opens and closes. It changes a date and a list,
      adds a reference and edits the note. No raw syntax shows on the
      main path. The shipped editor replaced the prototype. Reference
      waits for ticket 0091.
- [x] A failed write keeps the draft and reports it.
- [x] 44pt targets, named controls, keyboard and TalkBack reach every
      control. axe clean.
- [x] The editor ships from this ticket, minus reference.

## Outcome

The editor is a bottom sheet over Lists and Planner. Set properties
show as tiles, and unset ones show as chips in a strip. Due, Repeat,
List, Alerts and Note each open a picker. Alerts holds the alert weight.
No raw ISO or RRULE text shows outside the Advanced repeat field.

Every change writes at once through one queue per task. A failed write
keeps the value and offers Retry. Delete has a five-second Undo that
writes the exact file text back. ADR `20261116-task-editor-sheet`
records the trade-offs.

The operator skipped the separate web prototype. They asked for the
build to ship for the 1.0 release, and adjust it after.

Proof sits in PR 155. The full Playwright suite passed, and a web
journey covers every picker, Retry and Undo. The web cannot prove
keyboard insets, Android back or real SAF writes. The phone pass owes
those.

Reference waits for ticket 0091.
