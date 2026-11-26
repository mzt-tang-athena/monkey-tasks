---
title: The verify launch wants the shade shut
created: 2026-11-25
priority: low
assignee: claude-lane-shade
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

- [x] A launch with the shade open from a previous run passes.
- [x] Each heavy script passes when it starts with the shade open.

## Outcome

Every start of the app in the verify skill now shuts an open
notification shade first. `collapse_shade` lives in `android-env.sh`.
`android-launch.sh`, `android-drive.sh restart`, `new-run` and
`android-coldstart.sh` call it. Each journey calls `new-run`, so each
one starts with a shut shade. The reminder journey's own collapse at
its start no longer needs it.

Proof on the emulator at port 5584. The old launch stopped with the
shade open ("neither a task row nor the connect notice"). The new
launch passed with the shade open and with it shut. Four journeys
passed with the shade open: capture-reference-keyboard,
cold-start-vault-change, editor-keyboard, inbox-view-search.

Three journeys fail on the base too, shade shut or open:
list-swipe, references and reminder-actions. Each has its own
cause.
