---
title: A caller holding the heavy lock cannot wrap a heavy script
created: 2026-11-20
priority: normal
assignee: opencode
pr:
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

- [ ] A parent process holding the lock runs the script in place.
- [ ] A stranger holding the lock still waits.
- [ ] Both cases tested without a real hang.
- [ ] The skill's heavy section says not to wrap the scripts.

## Outcome

(filled in before moving to done/)
