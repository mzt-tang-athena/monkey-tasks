---
title: The verify launch wants the shade shut
created: 2026-11-25
priority: low
assignee:
pr:
depends: []
---

## Spec

The `verify-monkey-tasks` skill's Android launch fails when the
notification shade is open from an earlier run. The reminder journey
works around it by collapsing the shade first. The launch script
itself still does not, so every later run inherits the trap.

- Make the launch collapse an open shade before it starts, the way the
  reminder journey does.
- Check the other heavy scripts for the same assumption.

## Acceptance

- [ ] A launch with the shade open from a previous run passes.
- [ ] The other heavy scripts start with the shade open too.

## Outcome

(filled in before moving to done/)
