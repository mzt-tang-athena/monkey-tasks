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
- `editor-alerts` adds and removes reminders, and sets the alert weight.
- `editor-reference` links a note from `References/`, previews it and detaches it.
- `editor-note` edits the note body in a full height field.
- `editor-failed` keeps the draft and offers Retry.
- `editor-delete` removes the note, with Undo for five seconds.
- `editor-drag` closes the sheet on a drag down from the handle or the
  header row.

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
- **List.** `change list, <name>` (the visible name is the list's), then
  the list's name writes `list`. `Main` removes the key.
- **Alerts.** `add reminder`, then `save reminder`. Each reminder row has
  `remove reminder <words>`. A timed due shows a plain `At due` row with
  no remove control.
- **Alarm.** In the dialog `Alerts`, the switch `alarm` is off for a
  normal reminder. On writes `alert weight: harsh`, and the
  `change alerts` tile then ends in "Alarm". Off takes the key off the
  note. The switch hides while a reminder is in the add flow.
- **Reference.** `link a reference` opens the dialog `Reference`. The
  search field `Find a reference` matches a note by name or by an
  ingredient. A result reads `<name>, <category>, <type>` and a press
  attaches it; a second press attaches another. `browse the References
  folder` lists them all. `Done` closes. The tile lists each link as
  `open reference <name>`, which opens the preview dialog `Reference`,
  and `remove reference <name>`, which writes the section out. A link
  to a note that left the folder says so and offers
  `detach the missing reference`.
- **Note.** `edit note` opens the dialog `Note`. `done with the note`
  writes the body.
- **Title.** Fill `Task name`, then click `close the task`. The row
  reads the new name after a vault reread.
- **Failure.** `failNextWrite(page, "<name>.md")` before a pick. The alert
  `Not saved.` shows a plain line, never the raw error, with
  `retry save`. Retry writes the same draft.
- **Delete.** `task menu`, then the menuitem `Delete`. The alert
  `Task deleted` holds `undo delete`.
- **Drag to close.** `pullDown(page, input, target, sheetPx.close)` from
  `gestures.ts`, with `input` `touch` (needs `hasTouch`) or `mouse`. The
  target is the dialog's `sheet-handle` testID or a control in its
  header, such as `change list, <name>`. Past 80 px the dialog goes.
  `sheetPx.short` springs back to the same top. On a stacked picker only the picker goes. The capture sheet has
  only the handle. `e2e/specs/sheet-drag.spec.ts` covers each case.
- **Side effect.** `noteText` shows `due`, `recurrence`, `list`,
  `reminders`, `alert weight` and the body. Undo puts the exact text
  back. A reference writes `## Reference` and one `[[name]]` per line in
  the body. The frontmatter and every other body line keep their place.
- **Reference proof.** `journeys/references.journey.ts` takes search,
  attach, preview, re-read and detach, with the note on disk each time.
- **Width.** At 360 wide, four chips fit inside the sheet. They are
  `add due date`, `add repeat`, `add reminder` and `add note`. The testID
  `strip-fade-end` shows only when a chip waits past the edge.
- **Proof.** Screenshot the sheet at rest, each picker, the weight, the
  failed row, the toast and the sheet at 360. The journey
  `journeys/task-editor.journey.ts` takes every shot.

## Gotchas

- The page behind a modal is inert, so the capture toast hides while the
  editor shows. It comes back when the sheet closes.
- A stacked picker draws in the sheet layer, above the editor. The
  editor panel is `covered` while a picker shows.
- The editor has no route of its own. An alert tap pushes
  `/task/<id>`, which opens a task in the editor sheet and steps back.
  For a note that is not a task, it serves the read-only viewer.
- A picker body re-measures after its content changes. Wait about
  300 ms before a screenshot, or the shot catches the old height.
- Only the handle and the header row start a drag. A drag on the body
  scrolls the body, and a drag on the title selects text. The web
  cannot prove the native hand-over between the header pan and the
  body scroller. Nor can it prove the drag on the UI thread. Check
  both on the emulator.
- The web cannot prove the flick. Chrome sends one pointer move per
  frame, 20 to 50 ms apart on a busy runner. Gesture handler's web
  velocity then lands near the 500 px/s line, so a test flips by load.
  `app/src/lib/motion/sheet-drag.test.ts` holds the rule. Flick on the
  emulator.
- The title writes on close, never per keystroke. A test that types and
  reads the note at once sees the write a moment later. Use `poll`.
