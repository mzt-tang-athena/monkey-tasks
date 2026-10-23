---
id: 0033
title: A new list note does not add a tab
created: 2026-10-23
priority: high
assignee:
pr:
depends: [0010]
---

## Spec

Reported on the phone on 2026-10-23. `Tasks/Lists/Errands.md` was
created with `kind: [[lists]]` and a `created` date, and no Errands tab
appeared.

`parseListNote` accepts the quoted and bare forms, and requires
`created`. The unit tests for the loader pass. So the gap is either the
vault read not running after the file appears, or a SAF shape the tests
do not model.

## Acceptance

- [ ] A list note created while the app runs appears after a foreground
      return or a pull to refresh.
- [ ] The same note appears after an app restart.
- [ ] The loader's tests cover the SAF uri shapes the device produces.

## Outcome

(filled in before moving to done/)
