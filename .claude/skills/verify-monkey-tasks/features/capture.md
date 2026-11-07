# Capture

The add button in the bottom bar opens a capture sheet. The user types a
task in plain words. Chips under the field show the date and time the
parser read. Send writes a new task note and the row lands in its dated
section on the current list.

## Sub-features

- `capture-open` opens the sheet from the bottom bar on Lists and on Planner.
- `capture-parse` shows day and time chips for a date phrase.
- `capture-send` writes the note and lands the row.
- `capture-fail` keeps the draft and offers Retry when the write fails.

## How to get to it (user POV)

- Tap `Add` (accessible name `add task`) in the bottom bar.
- On Planner, the sheet takes the picked day as the due day.

## Driving it with Playwright

Preconditions: a fresh page on `/`.

- **Open.** `getByRole("button", { name: "add task" }).click()`. A field with placeholder `Add a task` takes focus.
- **Type.** `getByPlaceholder("Add a task").fill(capture.typed)`. Chips `Fri 30` and `5:00 PM` show.
- **Send.** `getByRole("button", { name: "send task" }).click()`. `row(page, capture.name)` shows under `Fri, 30 Oct` with `5:00 PM`.
- **Side effect.** `noteText(page, "Tasks/Buy stamps for card.md")` contains `due: 2026-10-30`. After `returnToTab` the row is still there.
- **Failure.** Call `failNextWrite(page, "<name>.md")` before Send. A toast offers `retry capture` and `dismiss capture failure`. Retry writes the note once.
- **Proof.** `journeys/capture.journey.ts` runs the open, type, send and side-effect steps with four screenshots.

## Gotchas

- The landed row is below the fold on Main. Scroll it into view before the screenshot.
- A name with a colon cannot be a file name. The note path drops the colon and the note keeps the name as `title:` (ADR 0028). Use `colonCapture` from `data.ts`.
- The sheet must close when its tab loses focus. PR #80 broke this, so check a nav press and the keyboard Tab path when you touch the dock.
- Keyboard insets and the sheet riding the keyboard are native only. The web cannot prove them.
