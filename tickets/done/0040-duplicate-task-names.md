---
id: 0040
title: A duplicate task name keeps its clean display name
created: 2026-10-25
priority: high
assignee: omp
pr: 58
depends: [0034]
---

## Spec

A task name is a file name. When a capture asks for `draw.md` and that
file exists, Android's document provider creates `draw (1).md`. The
optimistic row still says `draw`, so the suffix appears only after a
refresh. The same happens when the editor renames a note onto an
existing name.

The app cannot choose the provider's suffix, and a suffix is the
provider's and Obsidian's own convention. It is a fine file name. The
problem is the display, not the file.

After a create, read the name the file really got. When it differs
from the requested name, write `title: <requested name>` into the
note. The display already prefers `title`, so the row keeps its name
before and after a refresh. Do the same for an editor rename.

A note the user makes in Obsidian (`draw (1).md`) has no title and
keeps displaying its file name. The app never strips a suffix from a
name it did not create, because `(2)` can be part of a real name.

Writing a title from free text makes the emitter's quoting matter: a
name with a colon or a leading `#` must stay valid YAML. Extend
`serializeValue` to quote any string a YAML parser would misread.

Out of scope: UUIDs and inline checklists. ADR 0028 records why.

## Acceptance

- [ ] Capturing `draw` when `draw.md` exists creates `draw (1).md`
      with `title: draw`, and the row reads `draw` after a refresh.
- [ ] The optimistic row's file name and text match the file that
      landed, so the next write's compare passes.
- [ ] An editor rename onto an existing name behaves the same.
- [ ] A title with a colon, a leading `#`, `true`, or a number stays
      valid YAML and reads back unchanged.
- [ ] A hand-made `draw (1).md` with no title still displays
      `draw (1)`.
- [ ] Tests cover the created note, the capture row, the editor row
      and the emitter.

## Outcome

The app now reads the name the provider gave the file. When it differs
from the requested name, `createNote` writes the typed name as
`title`, and the row takes the file name, text and data the file
really has. The capture and the editor rename both go through it, so
the suffix never reaches the screen.

`serializeValue` quotes a value YAML would read as something else: a
colon, a leading indicator, `true`, or a number. A title with any of
those stays valid and reads back unchanged. A hand-made
`draw (1).md` with no title still displays its file name.

ADR 0028 records the decision and why UUIDs and inline checklists stay
out. Tests cover the created note, the capture row, the editor row and
the emitter.
