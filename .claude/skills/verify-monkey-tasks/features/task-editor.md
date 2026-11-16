# Task editor

A tap on a row opens the editor as a bottom sheet over the list. The
sheet holds the list picker and the title. A property with a value shows
as a tile. One without shows as a chip in the add strip. A picker is a
second sheet stacked over the editor. Each change writes at once. No
Save and no Cancel exist: closing the sheet keeps every write.

ADR `20261116-task-editor-sheet` is the decision. Ticket 0093 built it.

## Sub-features

- `editor-open` opens from a list row or a planner row.
- `editor-title` writes on blur, on submit and on close.
- `editor-due` picks a day and a time.
- `editor-repeat` picks a preset or writes an RRULE in Advanced.
- `editor-list` picks one list, or Main.
- `editor-alerts` adds and removes reminders.
- `editor-note` edits the note body in a full height field.
- `editor-failed` keeps the draft and offers Retry.
- `editor-delete` removes the note, with Undo for five seconds.

## How to get to it (user POV)

- Tap a row body (accessible name is the task's own name) on Lists or
  Planner. The dialog reads `Task`.

## Driving it with Playwright

Preconditions: a fresh page on `/`.

- **Open.** `row(page, name).getByRole("button", { name }).click()`. The
  dialog `Task` shows, with the textbox `Task name`.
- **Due.** `add due date`, then `Tomorrow` writes at once. `add a time`
  then `done with the date` writes a datetime. `clear due date` on the
  tile removes it.
- **Repeat.** `add repeat`, then `Weekly` writes `FREQ=WEEKLY`.
- **List.** `change list`, then the list's name writes `list`. `Main`
  removes the key.
- **Alerts.** `add reminder`, then `save reminder`. Each reminder row has
  `remove reminder <words>`.
- **Note.** `edit note` opens the dialog `Note`. `done with the note`
  writes the body.
- **Title.** Fill `Task name`, then click `close the task`. The row
  reads the new name after a vault reread.
- **Failure.** `failNextWrite(page, "<name>.md")` before a pick. The alert
  `Not saved.` shows, with `retry save`. Retry writes the same draft.
- **Delete.** `task menu`, then the menuitem `Delete`. The alert
  `Task deleted` holds `undo delete`.
- **Side effect.** `noteText` shows `due`, `recurrence`, `list`,
  `reminders` and the body. Undo puts the exact text back.
- **Proof.** Screenshot the sheet at rest, each picker, the failed row
  and the toast. The journey `journeys/task-editor.journey.ts` does all
  of it.

## Gotchas

- The page behind a modal is inert, so the capture toast hides while the
  editor shows. It comes back when the sheet closes.
- A stacked picker draws in the sheet layer, above the editor. The
  editor panel is `covered` while a picker shows.
- The editor has no route any more. `/task/<id>` serves only the
  read-only note viewer for a note that is not a task.
- The title writes on close, never per keystroke. A test that types and
  reads the note at once sees the write a moment later. Use `poll`.
