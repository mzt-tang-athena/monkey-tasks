---
id: 0051
title: Every file call goes through a vault adapter
created: 2026-10-26
priority: high
assignee: claude-code
pr:
depends: [0050]
---

## Spec

Today the store talks to the phone's folder in one way and to the
browser preview in another. On a phone every read and write goes
through Android SAF (`expo-file-system/legacy`). In the browser there
is no folder, so `lib/mock.ts` builds sample rows in memory, and every
store action has its own `if (!rootUri && Platform.OS === "web")`
branch. The preview therefore never runs the real write path, and
Playwright (ticket 0049) has nothing real to drive.

We put one port in front of the folder: a `VaultAdapter`. The SAF
adapter wraps today's code. A memory adapter holds the notes in a
`Map`, seeded from `.md` sample notes. It serves the web preview, the
component tests and Playwright. The store then has one code path. The
decision is ADR 0037.

### Paths

Ticket 0050 moves files before this ticket starts. The table gives the
path today and the home 0050 gives it. If 0050's Outcome names a
different file, follow the Outcome.

| Today | After 0050 |
|---|---|
| `app/src/features/vault/scan.ts` | `app/src/lib/vault/` |
| `app/src/features/vault/notes.ts` | `app/src/lib/vault/` |
| `app/src/features/vault/grant.ts` | `app/src/lib/vault/` |
| `app/src/features/vault/session.ts` | `app/src/lib/vault/` |
| `app/src/features/tasks/query.ts` (`loadTasks`, `taskFromText`) | `app/src/lib/vault/` |
| `app/src/features/lists/query.ts` (`loadLists`) | `app/src/lib/vault/` |
| `app/src/features/task-editor/save.ts` | `app/src/lib/vault/` |
| `app/src/lib/mock.ts` | deleted by this ticket |
| `app/src/store/tasks.tsx` | `app/src/stores/tasks/` |
| `app/src/store/query-client.ts` | `app/src/lib/` |
| `app/src/app/(tabs)/index.tsx` (the Lists screen) | `app/src/features/lists/` |

### The port

Add `app/src/lib/vault/adapter.ts`:

```ts
export type VaultEntry = { uri: string; name: string; isFolder: boolean };

export interface VaultAdapter {
  readonly kind: "saf" | "memory";
  /** The root the user granted before, or null. */
  savedRoot(): Promise<string | null>;
  /** Ask for a root. Null when the user cancels. */
  requestRoot(): Promise<string | null>;
  list(folderUri: string): Promise<VaultEntry[]>;
  findFolder(parentUri: string, name: string): Promise<string | null>;
  makeFolder(parentUri: string, name: string): Promise<string>;
  read(uri: string): Promise<string>;
  write(uri: string, text: string): Promise<void>;
  /** The provider may rename a taken name, for example "x (1).md". */
  create(
    folderUri: string,
    fileName: string,
    text: string,
  ): Promise<{ uri: string; fileName: string }>;
  /** A file already gone is not an error. */
  remove(uri: string): Promise<void>;
  parentOf(uri: string): string;
}
```

The vault functions take the adapter as their first argument:
`loadVault(adapter, root)` (today's `loadVaultTasks`, `loadTasks` and
`loadLists`), `readNote`, `writeNoteIfUnchanged`, `createNote`,
`deleteNote` and `saveTaskEdit`. The pure text functions
(`updateProperty`, `serializeValue`, `captureContent`, `spawnContent`,
`safeFileName`) stay as they are.

### The SAF adapter

Add `app/src/lib/vault/adapters/saf.ts`. Move the SAF calls into it
without changing behaviour:

- `scan.ts:16-76`: `displayName`, the folder probe in
  `isDirectoryUri`, `listDirectory`, `findSubfolder`,
  `makeDirectoryAsync`.
- `notes.ts:7-17` and `:66-96`: read, write, delete, and
  `createFileAsync` with the name the provider returns.
- `grant.ts:7-32`: the saved grant file and the folder picker.
- `save.ts:40-53` and `:81-116`: `parentUri`, and the create and
  delete calls inside `renameNote`.

After this ticket only `adapters/saf.ts` imports
`expo-file-system/legacy`. `lib/settings.ts` uses the new
`expo-file-system` API for app settings, not the vault, so it stays.

### The memory adapter

Add `app/src/lib/vault/adapters/memory.ts`:
`createMemoryVault(seed, options)`.

- Its root is `memory://vault`. It holds files and folders in a `Map`.
- `create` takes the name at once, before it awaits anything. A taken
  name gets " (1)", then " (2)", as Android's provider does. Two
  creates of one name in the same tick must get two names.
- `list` returns entries sorted by name, as `listDirectory` does.
- `options.latencyMs` delays every call. `options.fail(op, uri)` can
  return an error for a call, so a test can fail one write.
- With the test hooks on, the adapter sets `globalThis.__vault` to an
  object with `files()`, `read(path)`, `write(path, text)`,
  `reset(seed)`, `setLatency(ms)` and `failNext(op, name)`. The hooks
  are on when `__DEV__` is true or when
  `process.env.EXPO_PUBLIC_VAULT_TEST_HOOKS === "1"`. Ticket 0049
  builds its web export with that flag. No release APK has it, except
  the one the `android-e2e.yml` job builds and keeps (ADR 0037,
  2026-10-27 amendment).
- On the web the page query picks the seed and the hooks:
  `?vault=<seed>&latency=<ms>&fail=<op>:<file name>`. These work only
  with the hooks on.

### Sample notes

Replace `lib/mock.ts` with plain notes under
`app/src/lib/vault/sample/<seed>/Tasks/` and
`app/src/lib/vault/sample/<seed>/Tasks/Lists/`.

- Seed `default` holds today's sample: the 16 good tasks in
  `lib/mock.ts:88-156` and the 9 lists in `lib/mock.ts:164-177`. It
  must pass `npm run vault:check -- src/lib/vault/sample/default` with
  exit code 0.
- Seed `repair` holds the two broken notes on purpose:
  `Broken note.md` (`lib/mock.ts:137-146`) and `Lists/Garden.md`
  (`lib/mock.ts:179-188`). A test pins the exact findings that
  `vault:check` reports for it.
- The web preview with no `?vault=` loads `default` and then `repair`,
  so it still shows the repair block.
- `lib/mock.ts:101` stores the Supplements rule as `RRULE:FREQ=DAILY`.
  The schema wants the bare form, so the sample uses `FREQ=DAILY`.
- Today's sample dates are relative to today, so every group stays
  full. The sample notes are written against the day `2026-10-26`. At
  seed time the memory adapter moves every `YYYY-MM-DD` value in the
  frontmatter by the number of days between that day and today.
  Playwright pins today to `2026-10-26` (ticket 0049,
  `app/e2e/fixtures.ts`), so under the suite nothing moves.
- Keep every sample name and every relative date the same as
  `lib/mock.ts`. The Playwright specs read them from `app/e2e/data.ts`
  (ticket 0049). If a name or a date has to change, update
  `app/e2e/data.ts` in the same PR. The suite passes before and after
  this ticket.
- "Groceries: milk, eggs, oats" holds a colon, which a document
  provider refuses in a file name. Its note is
  `Groceries milk, eggs, oats.md` with
  `title: "Groceries: milk, eggs, oats"`, so the row shows the same
  name as today.
- Every sample task in `lib/mock.ts` gets the same `created` stamp, so
  My order falls back to the name. The sample notes keep one shared
  `created` value, so the order stays the same.
- Metro cannot import a `.md` file as text. A script,
  `npm run sample:build`, writes `app/src/lib/vault/sample/index.ts`
  as a map from seed to path to text. A test fails when that file is
  out of date with the notes.

### Choosing the adapter

Add `app/src/lib/vault/vault-provider.tsx` with `VaultProvider` and
`useVault()`. It returns `{ adapter, root, grant }`. Android gets the
SAF adapter. The web gets the memory adapter. Mount the provider in
`app/src/app/_layout.tsx`, above the task store.

### Remove the mock branches

Delete each of these from the task store (`store/tasks.tsx` today):

- The `["mock"]` query at `:275-285`. `refetch()` ignores
  `enabled: false`, so pull to refresh on a phone with no folder runs
  it and shows 17 sample tasks (repro below).
- The web branches in `toggle` (`:607-618`), `writeFields`
  (`:688-695`), `edit` (`:731-742`) and `capture` (`:781-801`).
- `editMockTask` and its helpers at `:102-188`.
- The `Platform.OS !== "web"` test in `status` at `:455`. With no root
  the store is ready and empty.
- `meta.mode`. The Lists screen shows the grant row when
  `mode === "mock"` (`app/(tabs)/index.tsx:829`). It now shows it when
  there is no root, or when the read failed.

`refresh` does nothing when there is no root. The vault query uses
`["tasks", root]` for every adapter.

### A read does not create a folder

`loadVaultTasks` calls `ensureSubfolder(root, "Tasks")`
(`session.ts:19`), so a read creates `Tasks/` when the listing misses
it. A slow provider listing can then create a second folder, and the
list shows empty. `loadVault` uses `findFolder` instead. With no
`Tasks/` folder it returns no rows and a null `tasksDir`. The first
create calls `makeFolder`, as capture already does at
`store/tasks.tsx:823`.

### Bugs this fixes, with their repro tests

The repro tests live in `app/src/testing/repro/store-races.test.tsx`,
under "preview and empty folder (ticket 0051)". Each one is an
`it.fails` today. Rewrite them against the memory adapter, then make
each a plain `it`.

| Bug | Where today | Repro test |
|---|---|---|
| Pull to refresh on a phone with no folder shows the sample set | `store/tasks.tsx:275-288`, `:868-870` | "keeps a phone with no folder empty after a refresh" |
| A browser focus rebuilds the sample set and drops every preview change | `store/tasks.tsx:284` | "keeps preview changes across a browser focus" |
| A no-op edit of the recurring sample turns it into a broken note | `lib/mock.ts:101` | "keeps the recurring sample valid after a no-op edit" |
| A read creates `Tasks/` | `features/vault/session.ts:19` | none yet: write one first |

Out of scope: the write path itself (ticket 0052), the parser
(ticket 0053), and alarms on the web.

## Acceptance

- [ ] `app/src/lib/vault/adapter.ts` exports the `VaultAdapter` port.
- [ ] Only `adapters/saf.ts` imports `expo-file-system/legacy`.
- [ ] One contract test runs the same cases against both adapters:
      list, read, write, create with a taken name, remove a missing
      file, find and make a folder.
- [ ] Two creates of one name in the same tick get two names in the
      memory adapter.
- [ ] `npm run vault:check -- src/lib/vault/sample/default` exits 0.
- [ ] A test pins the findings `vault:check` reports for the `repair`
      seed.
- [ ] A test fails when `sample/index.ts` is out of date with the
      notes.
- [ ] The sample Supplements note stores `recurrence: FREQ=DAILY`.
- [ ] The sample names and their relative dates match `lib/mock.ts`,
      or `app/e2e/data.ts` changes in the same PR.
- [ ] The Playwright suite (`npm run e2e`) passes on the commit before
      this ticket and on its last commit.
- [ ] `lib/mock.ts` and the `["mock"]` query are gone.
- [ ] No store action checks `Platform.OS` or `rootUri == null` to
      pick a mock path.
- [ ] Ticking a recurring sample task in the browser creates its next
      occurrence as a note (ADR 0027).
- [ ] In the browser, a capture of "Pay bill: water" still shows
      "Pay bill: water" after a refresh. The note is
      `Pay bill water.md` with that title (ticket 0053, ADR 0028).
- [ ] Latency and one failed write can be set from the page query and
      from `globalThis.__vault`.
- [ ] `globalThis.__vault` is undefined in a release build.
- [ ] A test reproduces each bug in the table first, and passes after
      the fix.
- [ ] The three ticket 0051 repro tests in
      `app/src/testing/repro/store-races.test.tsx` run as plain `it`.
- [ ] A read of a root with no `Tasks/` folder creates nothing.
- [ ] On the phone, ticking, capture, the editor, a drag and a reorder
      still work against a real vault.

## Outcome

(filled in before moving to done/)
