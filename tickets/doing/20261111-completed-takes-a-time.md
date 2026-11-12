---
title: Completed takes a time
created: 2026-11-11
priority: normal
assignee: omp
pr:
depends: []
---

## Spec

Ticket 0094 decided that `completed` takes a time as well as a date,
and that a new tick writes a local timestamp. Today the contracts
schema accepts a date only:

```
completed: isoDate.nullish(),
```

in `contracts/packages/schemas/src/vocabulary.ts`. The app's tick
writes a date, and the Completed section groups on the string.

Change the schema to `dateOrDatetime`. Write a local timestamp with
minutes from the app. Keep a value without a time valid forever,
because the live vault has none today but old notes may.

Every reader that compares completion to a day reads the date part,
not the whole string. That covers the Completed section, the tick
hold, and any count for a day.

The migration is the reader. No note is rewritten.

## Acceptance

- [ ] The schema accepts `2026-11-11` and `2026-11-11T18:08`.
- [ ] A tick writes a timestamp with the local date and minute.
- [ ] Grouping and "completed today" use the date part.
- [ ] A fixture holds both shapes, and the parser reads both.
- [ ] The vault is not rewritten.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0`, `npx vitest run` and the e2e pass.

## Outcome

(filled in before moving to done/)
