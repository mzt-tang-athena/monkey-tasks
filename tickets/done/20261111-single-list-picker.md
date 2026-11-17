---
title: Pick one list in the editor
created: 2026-11-11
priority: normal
assignee: opencode
pr: 155
depends: [0093, 20261111-one-list-field]
---

## Spec

The editor picks one list from the list notes. It replaces the free
newline field for `lists`. See ADR `20261111-one-list-and-tab-order`.

- One picker, single choice. The choices are the list notes in
  `Tasks/Lists/`, plus an empty choice for Main.
- The pick writes `list: "[[Name]]"`. The empty choice removes the
  key.
- A note that still carries `lists` shows its first link as the
  selection. A save writes `list` and drops `lists`.
- No free text. A name that matches no list note is not offered,
  because the app builds tabs from the notes.
- 0093 owns the editor rebuild. This picker lands inside that rebuild,
  not beside it.

## Acceptance

- [x] The editor shows one list choice, not a text field and not a
      multi-select.
- [x] Picking a list writes `list` and no `lists`.
- [x] Picking the empty choice removes the key.
- [x] A legacy note with two links shows the first and saves one.
- [x] The picker works with TalkBack and every target is 44pt.

## Outcome

The picker landed inside the 0093 editor rebuild, as this ticket
asked. The header control opens a searchable single choice: Main plus
the list notes. Main removes the key. Any other pick writes `list` and
drops `lists`. PR 155.
