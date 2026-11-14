---
title: Order the whole tab
created: 2026-11-11
priority: high
assignee:
pr:
depends: [20261111-main-holds-unfiled-tasks]
---

## Spec

`order` is the position of a task in its whole tab. See ADR
`20261111-one-list-and-tab-order` and the 2026-11-11 amendment to ADR
0031.

- In My order the tab renders one flat list, sorted by `order`. A drop
  lands anywhere, including across a place that used to start a date
  section.
- The drop and the grip steps renumber the open rows of the tab 1 to n.
  Write `order` only for the rows whose number changed, as an unquoted
  integer (ADR 0031).
- The fallback stays: a task without `order` sorts after the ordered
  ones, oldest `created` first, then by name.
- The Due sort does not change. It keeps Past, Today, the upcoming day
  sections and No date. `order` does not apply there, and a drag stays
  unavailable, as today (`canDrag = sortMode === "manual"` in
  `lists-screen.tsx`).
- Ties left by the old per-section numbers break by `created`, then by
  name. The first drop rewrites the tab.
- Opening a tab writes nothing.

Touches `selectSections` and `useListSections`, the lists screen's
reorder commit, the grip's step actions, and the reorder e2e specs.

## Acceptance

- [ ] In My order a tab is one flat list with no date headers.
- [ ] A drag moves a row from the top of the tab to the bottom and
      back.
- [ ] A drop writes 1 to n across the tab, and only changed notes.
- [ ] A task without `order` sits after the ordered ones, oldest
      `created` first.
- [ ] The Due sort still shows its date sections, and no drag starts
      there.
- [ ] e2e covers a drag across an old section boundary and reads the
      notes back.

## Outcome

(filled in before moving to done/)
