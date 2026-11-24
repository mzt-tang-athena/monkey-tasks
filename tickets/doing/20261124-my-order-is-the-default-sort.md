---
title: My order is the default sort, first in the menu
created: 2026-11-24
priority: normal
assignee: poteto-mode
pr:
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

- [ ] A fresh install opens Lists in My order.
- [ ] A saved "Due date" choice survives the update.
- [ ] My order is the first item in the sort menu.
- [ ] The sort button shows no changed mark in My order.

## Outcome

(filled in before moving to done/)
