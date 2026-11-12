---
title: Kind accepts both shapes
created: 2026-11-11
priority: normal
assignee: omp
pr: 128
depends: []
---

## Spec

Ticket 0094 decided that the parser accepts `kind` as a bare value and
as the link form, and that the app writes only the link form.

The contracts schema holds a strict literal per kind:

```
kind: z.literal("[[tasks]]"),
```

in `contracts/packages/schemas/src/vocabulary.ts`, and the same for
lists and deeds. A note with `kind: tasks` fails validation, so the app
cannot read a hand-written note or a note from another tool.

The read side accepts both shapes. A bare value becomes the link form
at the parse boundary, so every caller sees one shape. The write side
keeps the link form, and no code path produces the bare value.

This covers every kind the app reads, not just tasks. A one-off fix for
tasks would leave the same hole on lists.

The migration is the reader. No note is rewritten, and the write side
never changes a note that is only read.

## Acceptance

- [x] A fixture with `kind: tasks` reads, and its parsed value is
      `[[tasks]]`.
- [x] The same fixture with the link form reads unchanged.
- [x] Lists and deeds accept both shapes.
- [x] Every write path emits the link form, proven by a test.
- [x] The vault is not rewritten.
- [x] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0`, `npx vitest run` and the e2e pass.

## Outcome

The contracts schema accepts the bare kind and the link form for tasks,
deeds and lists, and returns the link form. One `kindLink` helper serves
all three schemas. contracts PR 14 merged that change, and PR 15 closed
the contracts ticket. Four new tests failed before the change with
`expected "[[tasks]]"`, and the contracts checks pass.

The submodule moves to the merged contracts commit. contracts main now
ships a built package, so the app builds the pinned package into `dist`
from `postinstall`. ADR 0007 records why, and ticket 0077 removes that
wiring with the submodule.

A sample note, `Tasks/Read the meter.md`, carries `kind: tasks`. It reads
as a task row, a Playwright test ticks it, and the note keeps its bare
kind and gains a `completed` date. The capture and spawn tests assert
the link form on every note the app writes. The task editor still
compares `kind` to `[[tasks]]`, which is the parsed form.

Gates: `npx tsc --noEmit` passes, `npx eslint src scripts e2e
--max-warnings 0` passes, `npx vitest run` passes 819 tests, and
`E2E_PORT=8603 npm run e2e` passes 440 tests with 26 skipped and none
failed. The app PR is 128 and waits for the operator to merge it.

CI ran the same 440 tests in 8.1 minutes, then its 10 minute job limit
cancelled the run one second later. The `e2e-web` limit is now 20
minutes. A main run in PR 124 was cancelled the same way.
