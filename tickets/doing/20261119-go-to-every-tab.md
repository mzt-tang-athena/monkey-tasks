---
title: Reach every tab from the command pane
created: 2026-11-19
priority: normal
assignee: omp
pr:
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
