# 0017. Mutations write behind a local list

- **Status:** accepted
- **Date:** 2026-10-22

## Context

Ticking, un-ticking, and capturing a task felt slow on the phone. Each
mutation waited for `load()`. It listed the vault root and the Tasks
folder, then read and parsed every note. It replaced the list, then
cancelled every alarm and scheduled every alarm again. The write itself
was a single file operation.
The reload was the cost, and it grew with the number of notes.

## Decision

The in-memory task list is the truth for the session. A mutation changes it
first, then writes the note in the background. The app reloads the vault on
boot, on pull to refresh, and on a new grant. It also reloads when it
returns to the foreground. It does not reload after a mutation.

Three rules keep the local list honest:

1. The optimistic patch runs the same `updateProperty` that the write runs.
   The local note text moves with the change, so a second tap builds on the
   first.
2. Writes to one note go through one queue. The queue writes a note once
   per change, in order. A failed write rolls the row back.
3. Alarms follow the task, not the vault. A tick cancels that task's alarms
   and schedules its new ones. The full rebuild stays on load.

Capture has the same shape. The row appears at once with a provisional
uri, then takes the real uri that `createFileAsync` returns.

## Consequences

A tap costs one file write instead of one write plus a full vault read. The
cost no longer grows with the vault.

The local note text can go stale when another app edits the file. Obsidian
is the expected other writer. A return to the foreground reloads, which
bounds the window. A write during that window can lose the outside
edit. We accept that because the alternative is a full read on every tap.

## Alternatives

**Reload in the background instead of not at all.** The row would update at
once, but every tap would still read every note and rebuild every alarm.
The cost stays O(vault) and the phone stays busy.

**Watch the folder for changes.** Android SAF has no cheap change feed.
A content observer over a document tree is unreliable across providers.
Polling costs more than the foreground reload we chose.

## Amendment, 2026-10-26

The three rules still hold. ADR 0037 changes how the code keeps them.

Rule 1 stands. The optimistic step and the write run the same
`applyPatch`. A second tap now builds on the first through the query
cache, not through a ref.

Rule 2 now runs on TanStack mutations. One scope, `{ id: "vault" }`,
replaces the queue per note. Writes to every note run in one line, in
call order. A failed write still rolls back only its own change.

The code did not keep rule 3. An effect rebuilt every alarm after
every cache write, not only on load. A full rebuild now runs only after
a read from disk, and all alarm work runs on one serial chain.

Capture's provisional uri becomes a row id that stays the same for the
session. The read carries it forward by uri.

A field write now reads the note, applies its patch to the text it
finds, and writes that. An outside edit to another property survives
the write. The editor still refuses a save when the note changed.
