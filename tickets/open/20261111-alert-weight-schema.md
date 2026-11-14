---
title: Alert weight in the schema
created: 2026-11-11
priority: high
assignee:
pr:
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
3. An unknown value, a typo or a number falls back to `harsh` and returns a
   repair error in the note's `errors` list. A typo must never make an alert
   silent.
4. A note with `alert weight: harsh` parses the same as a note with no key.
5. Do not add a wikilink or a boolean form.

Fixtures: absent, `harsh`, `quiet`, an unknown value, and a value with the
wrong case (`Quiet`). The last two read as harsh and raise the repair error.

The contracts package is its own repo. Open its PR there, then bump the
submodule pointer here in a second commit on this branch.

## Acceptance

- [ ] `TaskFrontmatter` carries an optional `alert weight` of `harsh` or
      `quiet`.
- [ ] A fixture proves absent reads as `harsh`.
- [ ] A fixture proves `quiet` survives a parse and a write round trip.
- [ ] An unknown value reads as `harsh` and raises a repair error.
- [ ] Merge the contracts PR and bump the submodule pointer.
- [ ] `npx tsc --noEmit` and lint pass in both repos.

## Outcome

(filled in before moving to done/)
