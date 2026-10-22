# 0015. The Main tab is the catch-all

- **Status:** accepted
- **Date:** 2026-10-22

## Context

The Lists screen has two tabs, Focus and Main. Tasks carry a list tag.
Some tags have no tab: Work and Errands exist in the vault but have no
screen. Filtering Main by a fixed list would hide those tasks. A user
could add a task and then not find it.

## Decision

Main shows every task that is not on Focus. Main is a view over the task
set, not a stored list. We rejected a stored Main list because a task
tagged with another list could still fall outside both tabs.

## Consequences

Every task appears on one of the two tabs, so no task can be invisible.
Main does not map to a vault list, so capture into Main writes no list
tag. A later tab for Work or Errands only changes the filter.
