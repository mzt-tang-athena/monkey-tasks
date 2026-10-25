# 0028. Duplicate task names keep a clean title

- **Status:** accepted
- **Date:** 2026-10-25

## Context

A task name is a file name. Android's document provider appends " (1)"
when the name is taken, so a second task called `draw` lands in
`draw (1).md`. The row showed the suffix after a refresh, and the user
read it as part of the name.

The alternatives were a UUID in the file name or inline checklists in
one note. A UUID makes the file unreadable in Obsidian, and links
cannot resolve it. Inline checklists change the unit of the vault from
a note to a line, and every link, deed, and list note would move with
it.

## Decision

We keep the provider's ` (N)` suffix in the file name. When the app
creates a note and the name it got differs from the name it asked for,
it writes `title: <requested name>` into the note. The display prefers
`title`, so the row keeps the name the user typed, before and after a
refresh.

A note made by hand in Obsidian has no title and shows its file name.
The app does not strip a suffix from a name it did not create, because
`(2)` can be part of a real name.

## Consequences

Duplicate names are allowed and read the same, which is how Google
Tasks behaves. The file name stays readable and links keep working.
The suffix is visible in Obsidian's file list, which is the place
where a unique name matters.

Free text now reaches the emitter through `title`, so `serializeValue`
quotes any value YAML would read as something else: a colon, a leading
indicator, a boolean, a number.
