# 0017. Mutations write behind a local list

- **Status:** accepted
- **Date:** 2026-10-22

## Context

Ticking, un-ticking, and capturing a task felt slow on the phone. Each
mutation waited for `load()`: list the vault root, list the Tasks folder,
read every note, parse it, replace the list, then cancel every alarm and
schedule every alarm again. The write itself was a single file operation.
The reload was the cost, and it grew with the number of notes.

## Decision

The in-memory task list is the truth for the session. A mutation changes it
first, then writes the note in the background. The app reloads the vault on
boot, on pull to refresh, on a new grant, and when it returns to the
foreground. It does not reload after a mutation.

Three rules keep the local list honest:

1. The optimistic patch runs the same `updateProperty` that the write runs.
   The local note text moves with the change, so a second tap builds on the
   first.
2. Writes to one note go through one queue. A note is written once per
   change, in order, and a failed write rolls the row back.
3. Alarms follow the task, not the vault. A tick cancels that task's alarms
   and schedules its new ones. The full rebuild stays on load.

Capture is the same shape: the row appears at once with a provisional uri,
then takes the real uri that `createFileAsync` returns.

## Consequences

A tap costs one file write instead of one write plus a full vault read. The
cost no longer grows with the vault.

The local note text can go stale when another app edits the file. Obsidian
is the expected other writer. A return to the foreground reloads, so the
window is bounded, and a write during that window can lose the outside
edit. We accept that because the alternative is a full read on every tap.

## Alternatives

**Reload in the background instead of not at all.** The row would update at
once, but every tap would still read every note and rebuild every alarm.
The cost stays O(vault) and the phone stays busy.

**Watch the folder for changes.** Android SAF has no cheap change feed.
A content observer over a document tree is unreliable across providers.
Polling costs more than the foreground reload we chose.
