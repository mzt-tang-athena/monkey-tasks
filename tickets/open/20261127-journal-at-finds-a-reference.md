---
title: The Journal's @ finds a reference, and food comes from it
created: 2026-11-27
priority: normal
assignee:
pr:
depends: [20261127-journal-writes-on-the-page]
---

## Spec

Build the reference half of ADR `20261127-journal-tap-to-write`.

- `@` plus letters lists matching `References/` notes, five at most.
- A pick writes `[[name]]` in place of the typed text.
- No match keeps the text. The list never creates a note.
- A line that links a food reference gets `#food` on save.
- Add on this tab starts a session with `@` typed.
- New lines get no `Ate:`. Old `Ate` lines still show and count.

Check the real vault first. The ADR says a food reference holds
`[[foods]]` in `types`. The sample uses `kind: "[[foods]]"`. Fix the
rule or the sample, and amend the ADR if the rule moves.

## Acceptance

- [ ] `@oat` lists `oatmeal`; a pick writes `[[oatmeal]]`.
- [ ] A line linking a food reference saves with `#food`.
- [ ] A line with no food link saves with no tag.
- [ ] Add opens a session with the list showing.
- [ ] Emulator frames of the list above the keyboard.

## Outcome

(filled in before moving to done/)
