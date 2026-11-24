---
title: The emulator lock deadlocks a caller that holds it
created: 2026-11-24
priority: normal
assignee:
pr:
depends: []
---

## Spec

`heavy-emulator.sh` ends in `exec flock -o
/tmp/monkey-tasks-emulator.lock "$@"`. A caller that wraps it in its
own `flock` on that file already holds the lock. The `exec` then waits
on the caller forever.

`heavy.sh` had the same trap for the heavy lock, and #210 fixed it
there. It reads `/proc/locks` with `lslocks` and walks its own
ancestry. When an ancestor holds the lock, it runs in place.

Do the same check for the emulator lock, in place, in
`heavy-emulator.sh`. `MONKEY_EMULATOR_LOCK_FILE` stands in for the
lock path, so a test never queues behind a lane's emulator. Add the
case to `test-heavy.sh` under `timeout`.

## Acceptance

- [ ] A caller holding the emulator lock runs the job in place, with
      no second lock wait.
- [ ] A stranger's lock still makes the job wait.
- [ ] The test ends under `timeout` and uses its own lock file.

## Outcome

(filled in before moving to done/)
