---
title: Kind accepts both shapes
created: 2026-11-11
priority: normal
assignee:
pr:
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

- [ ] A fixture with `kind: tasks` reads, and its parsed value is
      `[[tasks]]`.
- [ ] The same fixture with the link form reads unchanged.
- [ ] Lists and deeds accept both shapes.
- [ ] Every write path emits the link form, proven by a test.
- [ ] The vault is not rewritten.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0`, `npx vitest run` and the e2e pass.

## Outcome

(filled in before moving to done/)
