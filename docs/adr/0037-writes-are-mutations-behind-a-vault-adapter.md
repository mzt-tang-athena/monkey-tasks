# 0037. Writes are mutations behind a vault adapter

- **Status:** accepted
- **Date:** 2026-10-26

## Context

ADR 0017 made every write local first. The row changes in the same
frame as the tap, and the note is written behind it. ADR 0023 moved the
vault read into TanStack Query. It kept the write path by hand: a
promise queue per note, a ref that mirrors the cache, a counter that
makes a read retry when a write overlaps it, one error string for every
action, and a context of actions.

An audit on 2026-10-26 reproduced a dozen write-path bugs with tests.
A capture made during a read vanishes. A third overlapping read lands
old text. An earlier write's result flickers over a later tap. A read
that lands just before a tap is lost. A recurring double tap spawns a
second note. Every tap rebuilds every alarm, and two rebuilds can ring
one reminder twice. One failure's message is wiped by the next success.
Each of these comes from a rule the hand-made parts depend on: bump
the counter, read the ref, clear the string. A new write path has to
remember all three.

The browser preview has a second problem. It has no folder, so every
action has a mock branch that edits sample rows in memory. The preview
never runs the real write path, and the rebuild's Playwright suite
(ADR 0038) needs one.

## Decision

Every vault write is a TanStack `useMutation` hook, one per use case,
in `src/stores/tasks/mutations/`. All of them share one scope,
`{ id: "vault" }`, so writes run one at a time in call order.

The hooks keep ADR 0017's rules:

- `onMutate` cancels a read in flight, then applies the same
  `applyPatch` the write runs. It builds on the cache, so a second tap
  builds on the first.
- A read waits until no vault write is pending. When the last write
  settles, it runs again any read a write cancelled. No other read
  follows a write.
- A failed write rolls back only the rows that still hold its change.
  We never restore a snapshot of the whole list.
- Alarms follow the task. A write syncs that task's alarms. A full
  rebuild runs only after a read from disk. All alarm work runs on one
  serial chain.

A row's id stays the same for the session. The read carries ids forward
by uri. A write queued behind a capture looks up the real uri when it
runs. Failures are the failed mutations, read with `useMutationState`.
Each one has its own label, dismiss and retry.

Every file call goes through a `VaultAdapter` port in
`src/lib/vault/`. Android uses the SAF adapter, which wraps today's
code. The web preview, component tests and Playwright use a memory
adapter. It is seeded from `.md` sample notes, takes injected latency
and failures, and exposes `globalThis.__vault` in dev and test builds
only. The store has no mock branch.

We considered three other paths and rejected them:

- **Keep the hand-made queue and fix each bug in place.** Each fix
  works, but the rules that caused the bugs stay. ADR 0023 rejected
  mutations because "the queue and the provisional row would still be
  ours". A mutation scope replaces the queue. Only the provisional id
  stays, and it shrinks to a lookup by id.
- **One scope per note.** Writes to different notes could run in
  parallel. `useMutation` fixes the scope per hook, so each call would
  need its own observer. A recurring tick, a reorder drop and a capture
  each touch several notes, and per-note scopes would not order them.
  Rows are optimistic either way, so parallel writes buy little.
- **Keep the mock branches and add a store for the preview later.** Two
  write paths stay, and the preview keeps testing the wrong one.

## Consequences

The store loses the queue, the ref, the counter, the error string, the
actions context and the mock branches. A new use case is a new hook.
The preview and Playwright run the same write path as the phone.

One global scope means a slow write delays every later write, even to
another note. A cloud provider can take a second per write. The user
does not see the delay, because rows stay optimistic. A failure arrives
later, though, and a refresh waits for the queue to drain.

The memory adapter must behave like the provider. It renames a taken
name to "x (1).md" and takes the name before it awaits anything. One
contract test runs against both adapters, so a gap shows up in the
suite and not on the phone.

The test hooks must never ship. They switch on with `__DEV__` or with
`EXPO_PUBLIC_VAULT_TEST_HOOKS=1` at build time, and a release APK sets
neither.

Tickets 0051 (the adapter) and 0052 (the mutations) carry the work. ADR
0017 and ADR 0023 each have a dated amendment that points here.

## Amendment, 2026-10-27: one CI-only APK carries the test hooks

Ticket 0064 runs the 0051 contract suite against the SAF adapter on an
Android emulator. The suite needs the test hooks in an APK that the
emulator installs. So one build may set
`EXPO_PUBLIC_VAULT_TEST_HOOKS=1`: the x86_64 APK that
`android-e2e.yml` builds when its `saf-contract` input is on. That APK
never leaves the job. The workflow uploads no artifact of it, and
`android.yml` never sets the flag. Every release APK that reaches a
phone still has no hooks.

We rejected a second, flagged artifact from `android.yml`. That
workflow also builds the phone APK, so one wrong download would put
the hooks on a phone. We rejected a debug build on the emulator. It
runs JavaScript in development mode, so it tests less of what ships.
