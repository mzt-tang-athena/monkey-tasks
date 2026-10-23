# 0023. The vault read is a query

- **Status:** accepted
- **Date:** 2026-10-23

## Context

The store kept the vault list in its own state: a `tasks` array, a
`load` callback, a status flag and an AppState listener that reloaded on
return. That is the same job a data-fetching library does, written by
hand, and it grew a queue and a rollback on top.

## Decision

TanStack Query owns the read. The cache key is `["tasks", rootUri]` and
the value is `{ tasksDir, tasks }`. The client sets `staleTime` and
`gcTime` to infinity, so nothing refetches on a timer or on a remount.
Reads happen on mount, on grant, on refresh, and on foreground.

Native has no `visibilitychange`, so the client maps AppState to the
focus manager. Without that mapping the focus refetch would never run on
a device.

Writes stay local first. A mutation writes through `setQueryData`, keeps
the per-note queue, and rolls back on failure. A read waits for in-flight
writes before it scans, so a reload cannot read old text back over a row
the user just changed.

## Consequences

The store no longer owns a cache, a status flag or a focus listener. A
screen gets pending and error states from the query. The mutation path is
unchanged, which matters because it carries the behaviour pinned by
ADR 0017 and the store tests.

The app now depends on `@tanstack/react-query`. The library's defaults
assume a network source; this app overrides the staleness and retry
policy to match a local folder.

## Alternatives

**Keep the hand-rolled store.** It worked, but every new surface (a
second vault, a sync backend) would extend it by hand.

**React Query for writes too.** Mutations would wrap the same functions.
The queue and the provisional row would still be ours, so it would add a
layer without removing work.
