---
id: 0035
title: Every write compares the text it read
created: 2026-10-24
priority: high
assignee: omp
pr: 51
depends: [0032]
---

## Spec

Every write goes through one chokepoint. Today each writer reads a
file, edits the text in memory, and writes the whole file back.
Obsidian or the vault sync can save the file between the read and the
write. The write then drops that change with no word. Two devices share
the vault, so the window is real.

The app holds the text it read. Before writing, it reads the file again
and compares. Same text: the write goes ahead. Different text: the
chokepoint refuses the write and leaves the file untouched. The refusal
carries a typed error the UI can show. A missing file is its own error,
because a delete is not a conflict.

Applies to capture, tick, drag, the editor and property writes. Put the
check around `updateProperty` in `app/src/features/vault/notes.ts`, or
in a small module beside it that every writer calls. The property writer
already maps note text to note text, so the file step fits around it.

Out of scope: merges, retries, an `updatedAt` property.

## Acceptance

- [ ] A write with the same file text goes ahead and returns.
- [ ] When the file text differs, the chokepoint refuses the write,
      returns the conflict error, and leaves the file byte-identical.
- [ ] A missing file returns its own error, not the conflict error.
- [ ] Capture, tick, drag, the editor and every property write go
      through the chokepoint.
- [ ] A test covers all three outcomes: unchanged, changed, missing.
- [ ] The editor keeps its draft on a refusal and shows the error.

## Outcome

`writeNoteIfUnchanged` reads the file again and writes only when it
still holds the text the caller started from. The store queue, the
editor and a rename all pass that text. A file that cannot be read back
is its own error.

The first cut still let a save overwrite an Obsidian edit: the editor
seeded its draft at mount but compared against the store's text at save
time, which a foreground refresh had already replaced. The draft now
carries the text it was seeded from.

A second hole: a vault read that started before a save could resolve
after it and put the old text back in the row. The editor's whole
read-modify-write now joins the per-note queue, and a read that
overlapped a queued write reads again.

Confirmed on the phone with the reported steps: editing the note in
Obsidian and saving in the app now refuses with "the note changed on
disk" and keeps the draft. `tsc` clean, 199 tests in 26 files, eslint 0
errors.
