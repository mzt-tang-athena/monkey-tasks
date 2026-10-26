# 0035. Large refactors land on an integration branch

- **Status:** accepted
- **Date:** 2026-10-26

## Context

Ticket 0047 moves most of the app: the layout, the data layer, the
screens and the motion code. That is about fifteen PRs. Each one must
stay small enough to review. But the app is only worth a phone pass once
several of them have landed together.

We tried stacked PRs into main for ticket 0046. GitHub closed the upper
PR when its base branch merged and was deleted, so the work had to be
opened again as a new PR. A squash merge also rewrites the base, so
every PR above it needs a rebase.

## Decision

A refactor that spans many PRs gets one integration branch, named
`epic/<ticket>-<slug>`. Child PRs target that branch. Each child PR
squash-merges once its checks are green and a second agent has reviewed
it. One final PR takes the branch to main. It merges with a merge commit
after a phone pass, so main keeps one commit per child PR.

We rejected stacked PRs into main for the reasons above. We rejected
sequential PRs into main, because main would carry a half-moved app
between the steps and no two tickets could run in parallel.

## Consequences

Main stays shippable for the whole refactor. A dev client built from the
integration branch shows the combined result before main sees any of it.

The cost is one large final merge. Main must not move far while the
branch is open, and any fix that lands on main gets merged into the
branch at once. The merge commit is the one exception to the squash rule
in `AGENTS.md`.
