---
title: A menu hint belongs in the item's name
created: 2026-11-12
priority: normal
assignee: omp
pr: 136
depends: []
---

## Spec

`Menu` names every item with its label alone:
`accessibilityLabel={item.label}`. An item with a visible `hint` then
shows text that the accessible name does not contain. Axe reports
`label-content-name-mismatch` at serious impact, which is WCAG 2.5.3.

The Lists sort menu draws hints today: "Due date / Soonest first" and
"My order / Drag rows to sort". The gallery found this when it drew a
menu item with a hint, and it dropped the hint from its own menu so the
new axe bar stays green.

`CommandPane` already does it right: its row label is
`` `${row.label} ${row.hint}` `` when a hint exists. `Menu` should do the
same.

## Acceptance

- [x] `Menu` includes the hint in the item's accessible name, as
      `CommandPane` does.
- [x] `menu.test.tsx` names the hinted items by label and hint.
- [x] Every spec that finds a hinted menu item by name uses the new name.
- [x] The gallery's menu shows a hinted item again, and its axe scan
      stays clean in all four palettes.
- [x] `npx tsc --noEmit`, `npx eslint src scripts e2e --max-warnings 0`
      and `npx vitest run` pass.

## Outcome

`Menu` names a hinted item `` `${label} ${hint}` ``, the way
`CommandPane` names a row. The label's text carries a trailing space,
because the document joins the two blocks with nothing between them and
axe compares that text with the name. The space hangs at the line end. A
measurement at 412 wide showed no move in the label, the hint or the
menu height, for a short label and one that wraps. ADR
`20261112-menu-hint-in-the-name` records the choice.

Callers that find a hinted item by name now use the new name:
`menu.test.tsx`, `gallery.spec.ts`, `a11y.spec.ts`, `lists.spec.ts`,
`commands.spec.ts`, `reorder.spec.ts` and `settings.spec.ts`. The
gallery draws "Move to list / Pick a list" again, and its axe scan
reports no serious or critical finding in budget, todoist, clay and
midnight at 360 and 412 wide.

Gates: `npx tsc --noEmit` and
`npx eslint src scripts e2e --max-warnings 0` are clean.
`npx vitest run` passes 95 files and 833 tests. The Playwright suite
passes 456 tests with 26 skipped and no failures.

The first CI run failed the gallery's menu check: every row measured
40.9, the menu's size at 11 percent of its entrance. The check read a
computed opacity of 1 in the frame before the fade started. The target
scan now reads the box a widget lays out, and the menu check waits two
painted frames, so the target and axe scans read the menu at rest.
