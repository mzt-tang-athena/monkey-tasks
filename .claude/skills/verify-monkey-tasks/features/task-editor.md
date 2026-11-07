# Task editor

A tap on a row opens the task editor at `/task/<id>`. The user changes
the name, date, time, list or repeat, then saves or cancels and returns
to where they came from.

## Sub-features

- `editor-open` opens from a list row or a planner row.
- `editor-save` saves a change and returns.
- `editor-cancel` drops a change and returns.

## How to get to it (user POV)

- Tap a row body (accessible name `open task`) on Lists or Planner.

## Driving it with Playwright

Preconditions: a fresh page on `/`.

- **Open.** `row(page, rename.from).getByRole("button", { name: "open task" }).click()`. The textbox `Task name` holds `Call Mum`.
- **Save.** Fill `Task name` with `rename.to`, click `save task`. The URL is `/`, the row reads `Call Mum about Sunday`, and no `Call Mum` row is left.
- **Cancel.** Change the name, click `cancel editing`. The row keeps its old name.
- **Side effect.** After a save, `notePaths(page, "Tasks/")` and `noteText` show the renamed note, and the row survives `returnToTab`.
- **Proof.** Screenshot the editor with the change typed, and the list after the return.

## Gotchas

- Every row carries the same name `open task` today (ticket 0063 fixes it). Always scope the button to its row.
- The capture sheet must not stay over the editor. Open the editor once with the sheet open and check no dialog shows (PR #80 regression).
