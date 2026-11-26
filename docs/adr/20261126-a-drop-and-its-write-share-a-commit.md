# A drop and its write share one commit

- **Status:** accepted
- **Date:** 2026-11-26

## Context

A row dragged to a new place dropped there, and one frame drew the old
order before the new one. The operator saw it on the phone.

ADR 0032 says the drop reorders the data and zeroes the transforms in
one commit. Two steps broke that.

- The surface cleared its ghost and its shifts in the drop's handler.
- The caller's write applied its rows a microtask later. The mutation
  waits a yield before it calls `onMutate`.

TanStack's notify manager then told the query's subscribers on a
`setTimeout(0)`. The surface's clear reached React first, so the rows
snapped back to the old order. The new order came in a later commit.

## Decision

The caller's write runs before the surface clears. The query client
flushes its cache notifications in a microtask, not a timer. The drop's
write and the surface's clear now land in one commit.

We did not change the write path. The surface still clears on a drop,
and the caller still writes the same rows.

## Consequences

Every cache write tells its subscribers in a microtask, in the same
task as the write. A screen that changes its own state beside a write
draws both together. No frame falls between them.

A write now renders sooner than before. That is one render either way.
On a live clock the notification already ran before the next frame.

The index stamp still zeroes a moved row's shift. On the emulator one
frame after the drop can still draw that row at its old offset. The UI
thread applies the new style a frame later. That is a separate fault,
and it predates this record.

## Alternatives

**Hold the ghost and the shifts until the caller's write lands.** The
surface cannot see the caller's write. It would need the caller to
report the landing, and a second path for a drop that writes nothing.
That is a design change to how a drop reports.

**Run the optimistic step at `mutate()` time.** The comment in
`use-vault-mutation.ts` already claims it does. The mutation plumbing
would carry the context through the variables for every write. That is
a larger change than the drop needs.
