---
title: Order the whole tab
created: 2026-11-11
priority: high
assignee: omp
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

- [x] In My order a tab is one flat list with no date headers.
- [x] A drag moves a row from the top of the tab to the bottom and
      back.
- [x] A drop writes 1 to n across the tab, and only changed notes.
- [x] A task without `order` sits after the ordered ones, oldest
      `created` first.
- [x] The Due sort still shows its date sections, and no drag starts
      there.
- [x] e2e covers a drag across an old section boundary and reads the
      notes back.

## Outcome

Built on 2026-11-16, to merge after the 1.0 tag.

- My order returns one headerless group of every open row. A null
  title marks it, so no empty string can pass for a header. Completed
  keeps its group and header below.
- A drop and a grip step renumber the open rows 1 to n. They write
  only the rows whose number changed.
- Equal orders break by `created`, then name. The old per-section
  duplicates thus read in a stable order.
- Due order keeps its date sections and its missing drag.
- The sort switch remounts rows under a new group key. The old copy's
  cleanup ran late and deleted the new entry, so the grip found no
  rows. The reorder surface now records the mount that owns each entry,
  and cleanup removes only its own. A unit test fails without the
  guard.
- e2e adds a grip drag across an old section boundary. It reads 1, 2,
  3 and 12 back from the notes.
- A second case moves the top row to the bottom and back, through the
  grip's step actions.
- tsc, eslint and 863 vitest tests pass. `reorder.spec.ts` passes 41
  with 3 skipped. The verify journey reads My order, the drop, the
  Completed group and a list tab, and screenshots each.
