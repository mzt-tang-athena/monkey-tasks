---
title: A menu hint belongs in the item's name
created: 2026-11-12
priority: normal
assignee: omp
pr:
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

- [ ] `Menu` includes the hint in the item's accessible name, as
      `CommandPane` does.
- [ ] `menu.test.tsx` names the hinted items by label and hint.
- [ ] Every spec that finds a hinted menu item by name uses the new name.
- [ ] The gallery's menu shows a hinted item again, and its axe scan
      stays clean in all four palettes.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e --max-warnings 0`
      and `npx vitest run` pass.

## Outcome

(filled in before moving to done/)
