---
id: 0093
title: Rebuild the task editor
created: 2026-11-11
priority: high
assignee:
pr:
depends: [0082, 0091]
---

## Spec

The operator says the task editor "absolutely sucks" and wants it
rebuilt. They named Todoist's task view as the reference. The exact
parts they like are for the design session to settle.

Today the editor is six text fields in a column, from
`app/src/features/task-editor/components/task-editor-form.tsx`: Name,
Due, Recurrence, Lists, Reminders and Body. Due and reminders ask for
ISO text. Recurrence asks for an RRULE string such as `FREQ=WEEKLY`.
Lists ask for newline-separated names. There is no picker, no preview
of what the value means, and no way to change a property in one tap.

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

Deliver a spec in this ticket, three mockups of the same task (a due
date, a list, a reminder, a reference and a note), and a web prototype
of the chosen direction. Then split the build into child tickets. Write
an ADR if a real alternative remains.

## Acceptance

- [ ] The spec names every property, its control and the save model.
- [ ] Three directions show the same task, and the operator picks one.
- [ ] The prototype opens, changes a date, changes a list, adds a
      reference, edits the note and closes, with no raw syntax in the
      main path.
- [ ] A failed write keeps the draft and reports it.
- [ ] 44pt targets, named controls, keyboard and TalkBack reach every
      control. axe clean.
- [ ] The build is split into child tickets. No app code ships from
      this ticket.

## Outcome

(filled in before moving to done/)
