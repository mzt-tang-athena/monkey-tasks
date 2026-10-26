---
id: 0052
title: Vault writes become mutations
created: 2026-10-26
priority: high
assignee:
pr:
depends: [0051]
---

## Spec

ADR 0017 made every write local first: the row changes at once, and the
note is written behind it. ADR 0023 moved the read into TanStack Query
but kept the write path by hand. The task store holds a promise queue
per note, a ref that mirrors the cache, a write counter that makes a
read retry, one shared error string, and a context of actions. An
audit on 2026-10-26 found the bugs in the table below. Most of them
come from those hand-made parts.

We move every vault write to a TanStack `useMutation` hook, one per use
case, all in one mutation scope. The decision and its trade-offs are
ADR 0037. This ticket builds on the vault adapter from ticket 0051, so
every hook reads and writes through `useVault().adapter`.

### Paths

Ticket 0050 moves files first. If its Outcome names a different file,
follow the Outcome.

| Today | After 0050 |
|---|---|
| `app/src/store/tasks.tsx` | `app/src/stores/tasks/` |
| `app/src/store/task-actions.tsx`, `task-state.tsx` | `app/src/stores/tasks/` |
| `app/src/store/query-client.ts` | `app/src/lib/` |
| `app/src/features/reminders/sync.ts` | `app/src/stores/tasks/` |
| `app/src/features/reminders/schedule.ts` | `app/src/lib/` |
| `app/src/features/tasks/patch.ts` | `app/src/stores/tasks/` |
| `app/src/features/tasks/spawn.ts` | `app/src/lib/vault/` |
| `app/src/features/task-editor/save.ts` | `app/src/lib/vault/` |
| `app/src/app/(tabs)/index.tsx` (the Lists screen) | `app/src/features/lists/` |
| `app/src/features/planner/hooks/usePlannerGestures.ts` | `app/src/features/planner/` |
| `app/src/features/task-editor/TaskEditorScreen.tsx` | `app/src/features/task-editor/` |

Line numbers below are from `main` at `b2c0b10`.

### Repro tests come first

The repro tests are already in the repo, in
`app/src/testing/repro/store-races.test.tsx` (the "store races (ticket
0052)" block) and `app/src/testing/repro/reminders-race.test.ts`. Each
one is an `it.fails` that asserts the behaviour we want, so it passes
only while the bug is there. A fix turns its test into a plain `it`. A
fixed bug that keeps `it.fails` fails the suite, so no fix goes
unnoticed. When a step deletes the API a test drives, rewrite the test
against the new hook first, still failing, then fix.

### Bugs this fixes

| Bug | Where today | Repro test |
|---|---|---|
| A capture made while a read runs vanishes from the list. Capture never touches the write counter, so the read does not retry. | `store/tasks.tsx:817-846`, `:233-255` | "keeps a capture made while a read is in flight" |
| Every tap runs a full alarm rebuild, because each optimistic `setQueryData` gives `vault.data` a new identity. Two rebuilds, or a rebuild and a per-task sync, interleave and schedule one reminder twice. | `store/tasks.tsx:470-476`, `reminders/sync.ts:55-149` | "rebuilds alarms only after a vault read", and both tests in `reminders-race.test.ts` |
| A recurring tick waits for the create before the row moves. A second tap spawns a second successor, the compensation deletes it, and the banner shows `NoteChangedError`. | `store/tasks.tsx:642-646`, `:484-543` | "shows a recurring tick before the new note lands", "takes a double tap on a recurring task without an error" |
| The third read attempt neither waits for writes nor checks the counter, so it can land old text over a newer row. | `store/tasks.tsx:250` | "never lands a read that overlapped a write" |
| The first write's result replaces the row after a second tap moved it on. The row flickers back. | `store/tasks.tsx:662`, `:712` | "never shows an earlier tap over a later one" |
| A tap between a read landing and the ref effect writes a list built from the stale ref, which drops the read. | `store/tasks.tsx:301-331` | "keeps a read that lands just before a tap" |
| One error string serves every action. The next success clears an earlier failure. | `store/tasks.tsx:214` and each `setLastError(null)` | "keeps a failure on screen after an unrelated success" |
| A reorder drop writes one row at a time and rolls back only the failed row, so the section ends with mixed numbers. | `app/(tabs)/index.tsx:486-495` | "rolls back a whole reorder drop when one write fails" |
| A captured row takes the uri as its id on the next read, so an open editor loses it and shows "That task is no longer here." | `store/tasks.tsx:804-816`, `features/tasks/query.ts:59`, `TaskEditorScreen.tsx:97-123` | "keeps a captured row's id across a read" |
| A tap or a drag on a row whose file is still being created does nothing, with no message. | `store/tasks.tsx:629-631`, `:702-704` | "lands a tick on a row whose file is still being created" |
| When the note on disk no longer parses, the conflict retry writes it back unchanged and reports success. | `store/tasks.tsx:384-389`, `features/tasks/patch.ts:18-20` | "reports a tick that could not land on a broken note" |
| The compensation removes the new row even when its delete failed, so a live note hides until the next read. | `store/tasks.tsx:529-532` | "keeps showing a successor whose delete failed" |

Two cleanups ride along. The query client sets no `networkMode`, so a
future NetInfo hookup would pause every vault write while offline
(ADR 0003); set `networkMode: "always"` for queries and mutations in
`store/query-client.ts:30-50`. The comment on `setBlockList` in
`task-editor/save.ts:118-129` describes a bug that
`vault/notes.ts:143-149` already fixed; drop the double call. If ticket
0048 has not set `IS_REACT_ACT_ENVIRONMENT` in its setup file and
renamed `vitest.config.ts` to `.mts`, do both here: the store test
prints 74 act warnings per run today.

### Target layout

All under `app/src/stores/tasks/`:

| File | Holds |
|---|---|
| `query.ts` | `tasksQueryOptions(adapter, root, client)` and the key `["tasks", root]` |
| `read-gate.ts` | `vaultIdle(client)` and the deferred-read flag per key |
| `rows.ts` | pure row updaters: `rowById`, `patchRow`, `insertRow`, `removeRow`, `settleRow`, `rollbackRow`, `carryIds` |
| `mutations/use-vault-mutation.ts` | the shared wrapper below |
| `mutations/use-patch-task.ts` | `usePatchTask()`: one field write (drag to schedule) |
| `mutations/use-reorder-section.ts` | `useReorderSection()`: one drop |
| `mutations/use-toggle-task.ts` | `useToggleTask()`: tick and untick, recurring included |
| `mutations/use-capture-task.ts` | `useCaptureTask()` |
| `mutations/use-edit-task.ts` | `useEditTask()` |
| `use-vault-failures.ts` | `useVaultFailures()`: failed writes and notices |
| `reminder-sync.ts` | the alarm chain and `useReminderSync()` |

### The shared wrapper

```ts
export function useVaultMutation<V, R, C>(spec: {
  label: string;                                   // shown in a failure
  optimistic?(rows: TaskItem[], v: V): { rows: TaskItem[]; context: C };
  run(v: V, io: { adapter: VaultAdapter; rows(): TaskItem[] }): Promise<R>;
  settle?(rows: TaskItem[], v: V, r: R, c: C): TaskItem[];
  rollback?(rows: TaskItem[], v: V, c: C): TaskItem[];
}) {
  return useMutation({
    mutationKey: ["vault", spec.label],
    scope: { id: "vault" },
    networkMode: "always",
    gcTime: Infinity,
    meta: { label: spec.label },
    onMutate: async (v) => {
      // 1. mark the read deferred if one is in flight, 2. cancel it,
      // 3. apply spec.optimistic to `old` through setQueryData.
    },
    mutationFn: (v) => spec.run(v, io),
    onSuccess: (r, v, c) => {/* setQueryData with spec.settle */},
    onError: (_e, v, c) => {/* setQueryData with spec.rollback */},
    onSettled: () => {
      // When this is the last pending vault mutation and a read was
      // deferred, refetch it. Never invalidate otherwise.
    },
  });
}
```

Rules every hook follows:

1. One scope, `{ id: "vault" }`, for every vault write. Writes run one
   at a time, in call order. This replaces the queue at
   `store/tasks.tsx:221-223` and `:333-358`.
2. `onMutate` runs at `mutate()` time, even while the write waits for
   its turn. It reads the current rows from the cache through the
   `setQueryData` updater, never from a ref. Two taps chain because
   `onMutate` calls run in call order.
3. `onMutate` awaits `cancelQueries` before it touches the cache. When
   a read was in flight, it marks the read deferred. The last mutation
   to settle refetches a deferred read. No other read follows a write
   (ADR 0017). This replaces `writeSeq` and the retry loop at
   `store/tasks.tsx:225-255`.
4. The query's `queryFn` first awaits `vaultIdle(client)`: it resolves
   when `client.isMutating({ mutationKey: ["vault"] })` is 0. A
   foreground read that starts during a write waits for it.
5. `settle` and `rollback` change a row only when it still holds the
   text this mutation put there. They never restore a snapshot of the
   whole list, because that would undo other taps in flight.
6. Variables carry intent, not base text. A toggle sends
   `{ id, to: "done" | "open" }`, where `to` is the opposite of what
   the row showed. `run` reads the file, applies the same patch with
   `applyPatch`, and writes. When the file no longer parses, `run`
   throws, and the row rolls back. The editor still sends the text it
   opened and refuses on a conflict (ADR 0017's write check).
7. A row's `id` stays the same for the whole session. `run` looks up
   the uri by id when it starts, so a write queued behind a capture
   finds the real file.
8. A mutation calls `syncTaskReminders(before, after)` in `onSuccess`.

### Reads

`tasksQueryOptions` sets the key `["tasks", root]`,
`networkMode: "always"`, `refetchOnWindowFocus: "always"`, a `queryFn`
that awaits `vaultIdle` and then `loadVault(adapter, root)`, and
`structuralSharing: (old, next) => carryIds(old, replaceEqualDeep(old, next))`.
`carryIds` gives each new row the `id` of the old row with the same
uri. A captured row keeps its provisional id. A renamed row keeps its
first id.

### Each hook

- `usePatchTask()`. Variables `{ id, patch }`. Optimistic:
  `applyPatch` on the row. Run: read, patch, write. The planner calls it
  at `usePlannerGestures.ts:189`.
- `useReorderSection()`. Variables `{ changes: { id, order }[] }` from
  `reorderItems`. Optimistic: every row at once. Run: patch each note in
  turn. On a failure, write the old `order` back to the notes already
  changed, as far as that works, then throw. Rollback: every row that
  still holds this drop's text. One failure entry per drop. The Lists
  screen's loop at `app/(tabs)/index.tsx:486-495` becomes one call.
- `useToggleTask()`. Variables `{ id, to, successorId? }`.
  - A plain task patches `completed`.
  - A recurring task going to done, with a next date from
    `nextAfter`: the caller makes `successorId` (`pending://<n>`).
    Optimistic: complete the row and insert the successor row.
    Run: create the successor note (`spawnFileName` with the names in
    the cache at run time), then complete the current note. When the
    completion fails, delete the successor. When that delete fails too,
    keep the successor row and report both. Settle: give the successor
    row its uri and text, and keep its id. This keeps ADR 0027's order.
  - A recurring task going to open: optimistic reopens the row only.
    Run: reopen the note, then find the successor in the cache by
    `recurrence previous`. Delete it when `isUntouchedSpawn` holds,
    and drop its row after the delete. Otherwise resolve with
    `{ notice: "the next occurrence was edited, so both notes stay" }`.
- `useCaptureTask()`. Variables `{ id, draft }`, with the provisional
  id from the caller. Optimistic: insert the row (ADR 0021). Run: find
  or make `Tasks/`, then `createNote`. Settle: give the row its uri and
  file text, and keep its id. Rollback: remove the row. `mutateAsync`
  rejects, so the bar keeps its retry toast.
- `useEditTask()`. Variables `{ id, edit, expected }`. No optimistic
  step: the editor waits and shows a refusal. Run: `saveTaskEdit` on
  the row found by id. Settle: replace the row by id. A rename changes
  the uri and keeps the id.

### Alarms

`reminder-sync.ts` runs `syncReminders` and `syncTaskReminders` on one
promise chain, so two calls never interleave. `useReminderSync()`
subscribes to the query cache and queues a full rebuild only on an
`updated` event whose action is `success` and not `manual` for the
tasks key. That is a read from disk. A `setQueryData` never triggers
it. Delete the effect at `store/tasks.tsx:467-476`.

### Failures

`useVaultFailures()` reads `useMutationState` with the filter
`mutationKey: ["vault"]`. It lists each mutation whose status is
`error`, and each that succeeded with a `notice` in its result. Each
entry has the label, the message, `dismiss()` (removes it from the
mutation cache) and, for a failure, `retry()` (runs a
`MutationObserver` with the same options and variables, then removes
the old entry). The query client's `MutationCache` `onSuccess`
removes a successful vault mutation with no notice, so the cache does
not grow. A read error stays on the query. The banner on the Lists
screen (`app/(tabs)/index.tsx:939-958`) renders the list.

### Steps

Land this as three PRs into `epic/0047-rebuild`, in this order.

1. **Alarms and ids.** The alarm chain and `useReminderSync`.
   `carryIds` in the query's `structuralSharing`. `networkMode` and the
   `setBlockList` cleanup. Flip: both tests in
   `reminders-race.test.ts`, "rebuilds alarms only after a vault read",
   "keeps a captured row's id across a read".
2. **Writes become mutations.** `read-gate.ts`, `rows.ts`, the
   wrapper and the five hooks. The actions context stays for now, as a
   thin layer that calls the hooks, so the screens do not change except
   the reorder drop. Its `lastError` shows the newest failure. Delete
   `tasksRef` (`store/tasks.tsx:216-219`, `:316-320`), the queue,
   `writeSeq`, `readVault`'s loop, `queueWrite`, `queuePatch`,
   `applyTasks` and `patchOne`. Flip every other store repro test
   except the failure one.
3. **Failures and callers.** `useVaultFailures` and the banner. The
   screens call the hooks directly. Delete `lastError`, `clearError`
   and `store/task-actions.tsx`. Rewrite the store tests and the repro
   tests against the hooks. Flip "keeps a failure on screen after an
   unrelated success".

## Acceptance

- [ ] Each bug in the table had its repro test in the repo before its
      fix, as `it.fails`.
- [ ] Every repro test in the "store races (ticket 0052)" block runs
      as a plain `it` and passes.
- [ ] Both tests in `app/src/testing/repro/reminders-race.test.ts` run
      as plain `it` and pass.
- [ ] Every vault write runs through a hook under
      `app/src/stores/tasks/mutations/`.
- [ ] Every vault mutation uses `scope: { id: "vault" }` and a key
      that starts with `"vault"`.
- [ ] `grep -rn "tasksRef\|writeSeq\|queueWork\|lastError\|TaskActionsContext" app/src`
      finds no match.
- [ ] No `onSettled` or `onSuccess` calls `invalidateQueries` on the
      tasks key.
- [ ] A test shows that a tap reads no notes: the vault read count
      stays at one.
- [ ] A test shows two quick taps on one note chain: the second builds
      on the first, and the writes land in order.
- [ ] A test shows a failed write rolls back only its own row, and
      leaves a later tap on the same row alone.
- [ ] A test shows a read that starts during a write waits for it.
- [ ] A test shows a read cancelled by a write runs again once the last
      write settles.
- [ ] A test shows a capture row appears before its file exists and
      keeps its id after the file lands.
- [ ] A test shows a full alarm rebuild runs after a read from disk and
      after no cache write.
- [ ] A test shows a failure stays listed until it is dismissed or
      retried.
- [ ] A test shows a retry runs the same write again.
- [ ] The query client sets `networkMode: "always"` for queries and
      mutations.
- [ ] A run of the store tests prints no act warning.
- [ ] The Playwright suite (`npm run e2e`) passes after each of the
      three PRs.
- [ ] On the phone: tick, untick, a recurring tick and untick, capture,
      a drag to schedule, a reorder drop and an editor save all land in
      Obsidian, and each reminder rings once.

## Outcome

(filled in before moving to done/)
