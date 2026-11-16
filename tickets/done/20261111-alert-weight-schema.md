---
title: Alert weight in the schema
created: 2026-11-11
priority: high
assignee: opencode
pr: 150
depends: ["0094-review-the-task-note-schema"]
---

## Spec

Add the `alert weight` property to the task note schema. The parent decision
lives in `20261111-reminder-weight.md`; read it first.

The field is one optional frontmatter key:

```yaml
alert weight: quiet
```

- Key: `alert weight`, with a space, like the existing `recurrence previous`.
- Values: `harsh` and `quiet`.
- Absent means `harsh`.
- Only cues carry the line. The editor writes `quiet` and removes the key for
  a need.

Where the code lives:

- `contracts/` is a git submodule, and a fresh worktree lacks it.
  Run `git submodule update --init contracts` first.
- The package is `contracts/packages/schemas`, and the app links it as
  `file:../contracts/packages/schemas`.
- The type is `TaskFrontmatter` in
  `contracts/packages/schemas/src/vocabulary.ts`. The app imports it as
  `@monkey-tasks/schemas` and re-exports it through
  `app/src/types/task.ts`.

Rules:

1. Accept the spaced key. Confirm the Zod object parses `alert weight` and not
   only its camel case twin.
2. A missing key parses as `harsh`, so the notes need no migration.
3. An unknown value, a typo or a number falls back to `harsh`. The note
   stays valid, so its row stays and it rings. The contract also returns a
   warning for it, which Needs repair shows. A typo must never make an
   alert silent. See the ADR amendment of 2026-11-16.
4. A note with `alert weight: harsh` parses the same as a note with no key.
5. Do not add a wikilink or a boolean form.

Fixtures: absent, `harsh`, `quiet`, an unknown value, and a value with the
wrong case (`Quiet`). The last two read as harsh and raise the warning.

The contracts package is its own repo. Open its PR there, then bump the
submodule pointer here in a second commit on this branch.

## Acceptance

- [x] `TaskFrontmatter` carries an optional `alert weight` of `harsh` or
      `quiet`.
- [x] A fixture proves absent reads as `harsh`.
- [x] A fixture proves `quiet` survives a parse and a write round trip.
- [x] An unknown value reads as `harsh` and raises a warning. The row stays
      in its list, and Needs repair lists the warning.
- [x] Merge the contracts PR and bump the submodule pointer.
- [x] `npx tsc --noEmit` and lint pass in both repos.

## Outcome

Shipped on 2026-11-16, against contracts PR 19 and its follow-up doc PR 20.

- The contracts package reads the spaced key through
  `z.enum(alertWeights).default("harsh").catch("harsh")`, so the output is
  always `AlertWeight` and the input stays optional. `taskWarnings` reads the
  raw values and names each one it replaced, because the parsed data no
  longer holds the bad value.
- The app carries `warnings` on `TaskItem`. `taskFromText` and
  `saveTaskEdit` fill them, so a re-read row and a saved edit keep them.
- Needs repair takes one list of items with messages. A warned row keeps its
  place in its list. Only `errors` hide a row.
- A recurring task's next occurrence writes `alert weight: quiet` and no key
  for harsh. `isUntouchedSpawn` compares the weight.
- `vault:check` prints a `warning` finding and exits 0 for it.
- The repair sample seed gains `Descale the kettle` on the Focus tab. The
  e2e data and one spec assert its warning and its row.
- Hand-built `TaskFrontmatter` fixtures now carry
  `"alert weight": "harsh"`, because the parsed type always holds the key.
- Gates: `npm ci` at the root and in `app/`, `npx tsc --noEmit`,
  `npx eslint src scripts e2e --max-warnings 0`, `npx vitest run` (859
  tests), and `make check-records` pass.
- Local `E2E_PORT=8612 npm run e2e`: 454 passed, including the new spec.
  Fourteen axe-heavy gallery and theme tests hit the suite's 30 s cap. This
  4-core host ran at load 11 to 16 for that run. CI runs the same suite.
- Live preview on port 8320: a `loud` note kept its row, and Needs repair
  named it. A `quiet` note showed as a normal row with no warning. The
  evidence sits in `app/build/verify/evidence/20261116-052915`.
