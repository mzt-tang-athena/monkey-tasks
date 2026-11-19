---
title: Reach every tab from the command pane
created: 2026-11-19
priority: normal
assignee: omp
pr: 183
depends: []
---

## Spec

The command pane has a Go to Lists row and a Go to Planner row.
The app has four tabs: Lists, Planner, Journal and Inbox Notes.
Journal and Inbox Notes have no row, so the pane cannot reach them.

Add one Go to row for each of those two tabs.
They sit after Go to Planner, in the bar's tab order.
Each row navigates to its tab and closes the pane.
The rows live in `app/src/features/command/commands.ts`, and the
provider passes each action.

The search matches each screen's own words.
Journal matches "daily", "diary" and "food".
Inbox Notes matches "notes" and "scratch".

## Acceptance

- [ ] The pane lists four Go to rows, in tab order.
- [ ] Go to Journal lands the Journal screen.
- [ ] Go to Inbox Notes lands the Inbox Notes screen.
- [ ] Each row closes the pane.
- [ ] The search finds each row by its screen's words.
- [ ] Unit tests and the commands e2e hold the rows.
- [ ] A shot shows the pane with all four rows.

## Outcome

Shipped in #183. The pane carries four Go to rows, one per tab, in the
bar's order. Go to Journal and Go to Inbox Notes each land their screen
and close the pane.

The resting pane draws 11 rows of its 12-row cap. A later command
would push Diagnostics off.

Gate on `bad0923`: tsc, eslint with `--max-warnings 0`, 1206 vitest
tests and Vale pass. `check-records.sh` and `check-changelog.sh` pass.
The full web suite: 644 passed, 26 skipped.

`commands.spec.ts` presses all four rows in turn: 46 passed in both
projects. Shots of the pane at 412 and 360 in budget, and 412 in
midnight, sit under `app/build/verify/evidence/20261119-064750/`.
