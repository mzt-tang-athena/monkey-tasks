---
id: 0032
title: The frontmatter the app writes must mean the same thing to any YAML parser
created: 2026-10-23
priority: high
assignee: omp
pr: 47
depends: [0013]
---

## Spec

Two bugs shared one cause: the app and Obsidian read the same file with
different YAML semantics.

- `- [[Focus]]` is a nested array to a standard parser, not the string
  the app means. Obsidian rewrites what it read, and the link is lost.
- `reminders:   - 07:00` on one line is a string to a standard parser
  and a list to the app. Fixed in #38.

Obsidian had already done exactly that in the vault: two notes came
back as `- - - Focus`, the nested form it wrote after reading the bare
link. The app then read that as a list named `- - Focus`.

The app's own parser accepts both forms, so its tests passed. The
contract was never tested against a real YAML parser.

## Scope

One emitter, canonical values, and a test that parses every emitted
note with a real YAML library. The read path stays as it is: the vault
still holds legacy shapes, and a strict parser swap is a later move.

Out of scope: compare-and-swap on write (0035), task repair rows
(0036), the vault checker (0037).

## Acceptance

- [ ] Every wikilink the app writes is quoted, so a standard parser
      reads a string. Covers `lists`, `status`, and any other wikilink
      property, in the property writer and in capture.
- [ ] Capture uses the same serializer as the property writer. One
      emitter, not two.
- [ ] A test parses the written frontmatter with `js-yaml` and
      compares it with the intended values, for a scalar and a
      multi-item list.
- [ ] A test covers the inline-array regression: a one-item array
      writes as a block and parses as a list.
- [ ] The notes in the vault with bare wikilinks are rewritten once,
      and `js-yaml` reads each link as a string afterwards.

## Outcome

One emitter now writes every frontmatter value, and it quotes a
wikilink. Capture calls the same function instead of building lines by
hand. A js-yaml conformance test parses the emitted text and compares
the values, so the app can no longer write YAML that a standard parser
reads differently.

The vault held the proof: `Shop.md` had `- - - Focus`, the nested form
Obsidian wrote after reading a bare link. The app had been reading that
as a list named `- - Focus`.

The task notes are repaired: four bare links quoted, one nested link
restored, one dangling test property removed. A js-yaml pass over the
vault finds no nested value in a task note. Legacy bare deed statuses
stay for 0005.

Verified on the phone: the tasks still show under Focus and Errands
after the links became quoted. `tsc` clean, 193 tests in 26 files,
eslint 0 errors. CI was blocked on GitHub billing, so the merge rested
on the local gates.
