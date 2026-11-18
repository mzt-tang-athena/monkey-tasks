---
title: Status bar icons and Inbox title wrap
created: 2026-11-18
priority: high
assignee: omp
pr:
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

- [ ] Status bar icons are dark on Budget, Todoist and Clay.
- [ ] Midnight keeps light icons.
- [ ] A theme switch repaints the icons with no restart.
- [ ] The bottom navigation strip keeps its current look.
- [ ] A long title wraps after a hyphen and never at a stray letter.
- [ ] The card shows the name as written, with no added character.
- [ ] A test fails on main and passes with the fix.
- [ ] The emulator shows both fixes in Budget and Midnight.
- [ ] The gate passes: tsc, eslint, vitest, Vale, records, changelog.

## Outcome

(filled in before moving to done/)
