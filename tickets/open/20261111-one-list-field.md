---
title: One list field on the task note
created: 2026-11-11
priority: high
assignee:
pr:
depends: []
---

## Spec

The task note carries `list`, one wikilink. It replaces `lists`. See
ADR `20261111-one-list-and-tab-order`.

The schema lives in the `contracts` submodule at
`packages/schemas/src/vocabulary.ts`. A fresh clone leaves the
submodule empty, so run `git submodule update --init` first. Change the
schema there, publish it, and bump the version the app consumes (0077).

The app:

- Reads `list` as one wikilink.
- Still reads `lists` from old notes and takes its first link.
- Writes only `list`. `app/src/utils/yaml.ts` already writes one meta
  value, so use its scalar path for a link. Do not write a block list.
- Turns `TaskEdit.lists: string[]` into `list: string | null`.
- Accepts `list`, `lists` and neither in the parser's repair path and
  in `vault:check`.

Fixtures: one note with `list`, one with a two-item `lists`, one with
neither, in the schema tests and in the app parser tests.

This ticket writes no note in bulk.

## Acceptance

- [ ] A note with `list: "[[Focus]]"` parses to one list.
- [ ] A note with two `lists` links parses to the first, and reading
      it changes nothing.
- [ ] An editor save writes `list` and never `lists`.
- [ ] `vault:check` accepts all three shapes and flags a `list` value
      that is not a wikilink.
- [ ] A fixture covers each shape in the schema tests and in the app
      parser tests.

## Outcome

(filled in before moving to done/)
