# Vault sync

The app reads and writes Markdown notes in the Obsidian vault. Other
apps change the same notes. When the user comes back to the app, it
reads the vault again and shows the new state. A note that fails its
schema shows in the `Needs repair` banner, never as a row.

## Sub-features

- `vault-reread` shows notes written by another app after a return to the app.
- `vault-repair` lists invalid notes in the repair banner.
- `vault-recurring` writes the next occurrence of a repeating task when it is ticked.
- `vault-failure` keeps a failed write on screen with Retry.

## How to get to it (user POV)

- Edit a note in Obsidian, then switch back to the app.
- Tick a repeating task (sample `Supplements`).

## Driving it with Playwright

Preconditions: a fresh page on `/`.

- **Outside write.** `putNote(page, outsideNote.path, outsideNote.text)`, then `returnToTab(page)`. `row(page, outsideNote.name)` shows.
- **Repair.** The banner lists `Garden.md` and `Broken note.md`. `row(page, broken)` has count 0.
- **Recurring tick.** Tick `Supplements`. `noteText(page, supplementsTick.note)` has `completed: 2026-10-26`, and `supplementsTick.next` exists with due `2026-10-27T19:00`.
- **Failure.** `failNextWrite(page, "Supplements.md")`, then tick. The failure stays on screen with Retry, and a Retry after the write landed makes no second next occurrence.
- **Proof.** Attach `noteText` of each touched note, before and after.

## Gotchas

- The web vault is memory. A reload starts from the sample set again, so a reload does not prove persistence. `returnToTab` does.
- SAF folder access, file watching and conflict on a real phone are native only.
