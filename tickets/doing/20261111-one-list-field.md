---
title: One list field on the task note
created: 2026-11-11
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The task note carries `list`, one wikilink. It replaces `lists`. See
ADR `20261111-one-list-and-tab-order`.

The contract half is `20261114-task-list-field` in the contracts repo.
It adds `list`, keeps `lists` for validation, drops it in a transform
and promotes the first link. Merge that PR first.

The app pins the contract by submodule at
`file:../contracts/packages/schemas`. Bump the gitlink to the contracts
merge commit. Do not point at a PR head. No package publish is needed
until 0077 lands.

The app reads:

- `data.list`, one wikilink or absent. The schema transform means
  `data.lists` no longer exists.
- `inList` in `selectors.ts` compares the one link.
- `inSourceList` in the planner compares the one link, and Main means
  no list.
- `draftOf` seeds one name.
- `spawnInput` and `isUntouchedSpawn` copy and compare one value,
  normalizing null and absent.

The app writes:

- `TaskEdit.lists: string[]` becomes `list: string | null`.
- `saveTaskEdit` removes `lists` first, then writes `list` through the
  scalar `updateProperty` path. A cleared list removes both keys. If
  `lists` stays, the next read promotes its first link and the task
  returns to the old tab.
- `captureDraft` and `spawn` write one scalar, never a block list.
- The editor form gets one single-line List field for this ticket. The
  picker is `20261111-single-list-picker`, after 0093.
- `vault:check` accepts `list`, a legacy two-link `lists`, and neither.
  An empty `list:` is valid. `list: ""` and a block under `list` are
  findings.

Tests and samples:

- Update every `lists` fixture the map names, including selectors,
  spawn, capture, editor draft, planner, tasks provider, repro tests and
  the three Focus sample notes.
- Keep one legacy two-link fixture in the parser and save tests.
- Run `npm run sample:build` in `app` and commit the generated
  `index.ts`. The note counts stay the same because the three notes are
  converted, not added.
- e2e needs no change in this ticket. Main is still the catch-all until
  the sibling ticket.

This ticket writes no note in bulk.

## Acceptance

- [x] A note with `list: "[[Focus]]"` parses to one list.
- [x] A note with two `lists` links parses to the first, and reading
      it changes nothing.
- [x] `data.lists` is gone from the parsed task.
- [x] An editor save writes `list` and removes `lists`.
- [x] Clearing the list removes both keys, and the task leaves the tab.
- [x] Capture and spawn write one scalar, never a block list.
- [x] `vault:check` accepts all three shapes and flags a block under
      `list` and an empty string.
- [x] The sample notes use `list`, and the generated `index.ts` is
      current.
- [ ] `npx tsc --noEmit`, `npx vitest run`, `npx eslint` and the e2e
      suite pass.

## Outcome

Shipped on 2026-11-14.

- The contract submodule is at `85b22c1`, the merge of contracts PR 18.
  The app reads `data.list` and writes one scalar.
- `TaskEdit.list`, the tab filter, the planner source, capture, spawn
  and the editor field all carry one value.
- `saveTaskEdit` drops `lists` before writing `list`. Clearing a list
  removes both keys.
- The three Focus sample notes use `list`, and `sample:build`
  regenerated `index.ts`. The note counts stay 27 and 29.
- Local: tsc clean, eslint clean, 851 vitest tests pass, and
  `vault:check` reports 27 notes with 0 findings.
- Local e2e: 458 passed and 26 skipped. The only failures are gallery
  and theme axe scans that hit their 30 second timeout on this machine,
  in palettes that vary between runs. Recent CI runs pass the same
  suite, so CI on this PR is the final check.
