---
title: Status bar icons and Inbox title wrap
created: 2026-11-18
priority: high
assignee: omp
pr: 171
depends: []
---

## Spec

Two pixel defects seen on the 1.1.0 release APK.

First, the status bar draws white icons over a cream page. The clock,
the signal bars and the battery vanish on Budget, Todoist and Clay.
The app sets no status bar style, so Android keeps its default, and
the default is white. The bar must take its icon colour from the active
palette. It must follow a live theme switch with no restart. Midnight
keeps light icons.

Second, a long Inbox Notes title breaks mid-word. The card shows
`20261023-flight-email-t` then `racker`, and `20261022-indented-pas`
then `te`. Android fills the line to its last fitting character and
ignores the hyphens. The title is the file name as-is, so no fix may
change, split or join the name. A wrap belongs after a hyphen when one
fits the line. A break inside a word stays legal only when a single run
is wider than the card.

Leave the bottom system navigation strip alone. Ticket 0046 and PR 46
own it, and the operator has not decided it.

## Acceptance

- [x] Status bar icons are dark on Budget, Todoist and Clay.
- [x] Midnight keeps light icons.
- [x] A theme switch repaints the icons with no restart.
- [x] The bottom navigation strip keeps its current look.
- [x] A long title wraps after a hyphen and never at a stray letter.
- [x] The card shows the name as written, with no added character.
- [x] A test fails on main and passes with the fix.
- [x] The emulator shows both fixes in Budget and Midnight.
- [x] The gate passes: tsc, eslint, vitest, Vale, records, changelog.

## Outcome

Both fixed and proven on the release APK.

- Status bar: dark icons on the three light palettes.
- Midnight keeps light icons.
- A live switch repaints them with no restart.
- The native start is dark, so the splash reads too.
- A title breaks after a hyphen, never mid-word.
- `20261023-flight-email-` then `tracker` on the phone.
- The card changes no character of the name.
- The title has no three-line clamp.
- Tests: 5 card cases and 2 bar cases. 3 fail on main.
- Emulator: before on 1.1.0, after on this build.
- Budget and Midnight, status bar and titles.
- Web preview at 412: the same two lines, from four runs.
- Gate: tsc, eslint, 1186 vitest, Vale, records.
- Web suite: 612 passed, 26 skipped (CI).
- PR: 171.
- Evidence: the 105249 emulator run.
