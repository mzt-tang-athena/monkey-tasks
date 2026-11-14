---
title: Main holds the unfiled tasks
created: 2026-11-11
priority: high
assignee:
pr:
depends: [20261111-one-list-field]
---

## Spec

Main is the unfiled bucket. It shows the tasks with no list. A list tab
shows the tasks whose `list` carries that name. See ADR
`20261111-one-list-and-tab-order` and the 2026-11-11 amendment to ADR
0015.

- `selectTabTasks` in `app/src/stores/tasks/selectors.ts`: Main filters
  the tasks with no list; any other tab filters by that one list.
- A task changes tab the moment its list changes, with no copy.
- Capture into Main writes no `list`. Capture into a list tab writes
  that list.
- Hidden future occurrences and completed tasks keep their current
  rules.
- The empty Main state says Main holds unfiled tasks, and points at
  the list tabs.

Tests: replace the "shows every task on Main" case
(`selectors.test.ts:104`). Add three cases. An unfiled task shows on
Main only. A listed task shows on its tab and not on Main. Clearing
the list returns the task to Main.

## Acceptance

- [ ] Main shows only tasks with no list.
- [ ] A list tab shows only the tasks whose `list` is that name.
- [ ] Setting a list removes the task from Main. Clearing it returns
      the task.
- [ ] Capture into Main writes no `list`. Capture into a tab writes
      that list.
- [ ] Unit tests cover the three moves and replace the old catch-all
      test.

## Outcome

(filled in before moving to done/)
