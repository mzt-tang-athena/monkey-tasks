---
title: My order is the default sort, first in the menu
created: 2026-11-24
priority: normal
assignee: poteto-mode
pr: 226
depends: []
---

## Spec

The operator's feedback on 2026-11-24. In Lists, "My order" is the
default sort. The sort menu lists it first, above "Due date".
Today `lists-toolbar.tsx` lists Due date first, and the sort setting
defaults to `due` (`SortMode` in `lib/settings.ts`).

- Default the setting to `manual`. A phone that already saved a choice
  keeps it.
- Put My order first in the menu.
- The toolbar marks the sort button as changed away from the default.
  Move that mark to follow the new default.

## Acceptance

- [x] A fresh install opens Lists in My order.
- [x] A saved "Due date" choice survives the update.
- [x] My order is the first item in the sort menu.
- [x] The sort button shows no changed mark in My order.

## Outcome

`Settings.sortMode` defaults to `manual`, and `loadSettings` reads a
stored value before the default applies, so a saved `due` survives.
`src/lib/settings.test.ts` covers both paths, native file included. The
sort menu lists My order first, and the glyph fills only in Due date or
while its menu opens.

The specs that read a date section ask for Due date first through the
`useDueOrder` helper. PR #226.
