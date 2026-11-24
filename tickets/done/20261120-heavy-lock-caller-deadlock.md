---
title: A caller holding the heavy lock cannot wrap a heavy script
created: 2026-11-20
priority: normal
assignee: opencode
pr: 210
depends: []
---

## Spec

`heavy.sh` runs a job under `flock -o /tmp/monkey-tasks-heavy.lock`
unless `MONKEY_HEAVY_LOCK=1` says a caller holds it. A caller that wraps
the whole script in its own `flock` holds the lock forever. The script
then waits for the same lock. Two lanes lost time to this on 2026-11-20:
one 50 minutes, one 28.

The wrapper is a habit from before #200, when callers typed the lock
themselves. `scripts/gate.sh full` is now heavy itself, so wrapping it
deadlocks.

Make the footgun fail fast instead of hanging:

- `heavy.sh` detects a caller of its own process tree already holding
  the lock. It then runs in place with a printed line, as
  `MONKEY_HEAVY_LOCK=1` does. Find the holder with `fuser` or the lock
  file's open fds and compare the pid tree.
- Detection is best effort: a lock held by an unrelated process still
  waits, as today.
- A test with a parent holding the lock runs in place; a test with a
  stranger holding it waits.

## Acceptance

- [x] A parent process holding the lock runs the script in place.
- [x] A stranger holding the lock still waits.
- [x] Both cases tested without a real hang.
- [x] The skill's heavy section says not to wrap the scripts.

## Outcome

`heavy.sh` reads the lock's holder from `lslocks` (`/proc/locks`) and
walks this shell's parent chain. When a parent holds the lock, the job
runs in place with one printed line. A stranger's lock still waits.

`test-heavy.sh` proves both directions with a `timeout` on each case and
runs in `make ci`. `MONKEY_HEAVY_LOCK_FILE` points the test lock away from
the shared one. The skill's heavy section now says never to wrap the
scripts. Not fixed: a caller that holds the lock still loses the 8G cap
for that run. The printed line names it.
