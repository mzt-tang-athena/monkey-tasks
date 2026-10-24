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

## Amendment, 2026-10-24

Main now shows every task. It does not hide tasks on Focus, on Work, or
on any other list. Main is still a view, not a stored list.

Focus is now an ordinary list note. When Tasks/Lists/Focus.md exists it
gets a tab like any other list. The tab bar is Main followed by the list
names, so Main stays first. A task on Focus appears on both tabs.

We dropped the earlier Focus exception. It was a preference about how
Main should feel, not a correctness rule. The old filter also meant a
task could sit on Focus and never show on Main, which surprised people
who used Main as their inbox. Keeping every task on Main is simpler to
explain and simpler to code.

The rest of the original decision stands. Main never maps to a list note,
so capture into Main writes no list tag.

