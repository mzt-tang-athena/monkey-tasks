---
title: Completed takes a time
created: 2026-11-11
priority: normal
assignee: omp
pr:
depends: []
---

## Spec

Ticket 0094 decided that `completed` takes a time as well as a date,
and that a new tick writes a local timestamp. Today the contracts
schema accepts a date only:

```
completed: isoDate.nullish(),
```

in `contracts/packages/schemas/src/vocabulary.ts`. The app's tick
writes a date, and the Completed section groups on the string.

Change the schema to `dateOrDatetime`. Write a local timestamp with
minutes from the app. Keep a value without a time valid forever,
because the live vault has none today but old notes may.

Every reader that compares completion to a day reads the date part,
not the whole string. That covers the Completed section, the tick
hold, and any count for a day.

The migration is the reader. No note is rewritten.

## Acceptance

- [x] The schema accepts `2026-11-11` and `2026-11-11T18:08`.
- [x] A tick writes a timestamp with the local date and minute.
- [x] The Completed section and the tick hold read both shapes as
      done. No reader compares completion to a day.
- [x] A fixture holds both shapes, and the parser reads both.
- [x] The vault is not rewritten.
- [x] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0`, `npx vitest run` and the e2e pass.

## Outcome

A tick writes the local moment with `nowStamp()`, the one helper a new
note's `created` already uses. It carries the date and the minute, plus
seconds, exactly as `created` does. The schema accepts a date alone
forever, so an old note reads unchanged. No note is rewritten.

Readers of `completed` in the app, and the rule each uses:

| Reader | Rule |
|---|---|
| contracts `taskIsDone`, `spawn.isUntouchedSpawn` | presence |
| `groupByDue`, `useListSections` (the Completed section) | presence |
| `applyTickHold`, `useTickHold` | presence |
| `reminder-sync` | presence, through `taskIsDone` |
| `task-row-face`, planner `day-preview`, `list-page-preview` | presence, for the done look |

No reader compares completion to a day. The Completed section and the
tick hold are presence checks, so a timestamp leaves both correct, and
a grep for `completed` with any date math found no other reader. The
ADR 20261111 date-part rule binds the first reader that groups
completion by day. None exists in this tree.

Fixtures: `Tasks/Water the fern.md` holds
`completed: 2026-10-26T18:08`, and `Tasks/Buy stamps.md` keeps
`completed: 2026-10-26`. Both load as done in the parser test and both
show in the Completed section of the browser preview. The sample seed
moves a datetime by whole days and keeps its time.

Tests first. The tick test failed on the old code with
`expected '2026-11-12' to match /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/`
and passed after the change. The parser tests read both shapes,
including the exact `2026-11-11T18:08` value.

Contracts PR 16 changed `completed` to `dateOrDatetime` in the task
and deed schemas. Its tests failed first with 2 failures, then passed
89. Contracts PR 17 closed that ticket. The app pin is `fa95fed`.

Gates:

- `npx tsc --noEmit`: pass
- `npx eslint src scripts e2e --max-warnings 0`: pass, no warnings
- `npx vitest run`: 825 passed, 93 files
- `E2E_PORT=8604 npm run e2e`: 444 passed, 26 skipped, none failed

The app PR is <filled by the PR>.
