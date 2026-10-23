---
id: 0026
title: React Query owns the vault read
created: 2026-10-23
priority: normal
assignee: omp
pr:
depends: [0024]
---

## Spec

The store hand-rolled the cache for the vault: a `tasks` state, a
`load` callback, an AppState listener, and a status flag. React Query
does the same job with a smaller surface: a keyed cache, a pending and
error status, and a focus refetch.

Move the read layer onto TanStack Query and keep the write path local
first.

- One client in `store/query-client.ts`. The vault never goes stale on
  its own, so a read happens on mount, on grant, on refresh, and on
  foreground.
- Native has no `visibilitychange`, so the client maps AppState onto
  the focus manager.
- The cache holds `{ tasksDir, tasks }` under `["tasks", rootUri]`.
  Mutations write through `setQueryData`, which keeps the optimistic
  contract from ADR 0017.
- The write queue stays: one queued write per note, rollback on
  failure.
- A read waits for in-flight writes before scanning, so a reload cannot
  read old text back over a row the user just changed.

## Acceptance

- [ ] The vault is read on boot, on grant, on refresh, and on foreground.
- [ ] A mutation never triggers a read.
- [ ] A tick is visible before its write lands.
- [ ] The query cache holds the ticked row while the write is held.
- [ ] Screens use the same hooks as before.

## Outcome

(filled in before moving to done/)
