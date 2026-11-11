---
title: A tick that lands mid-drag leaves the drop stale
created: 2026-11-11
priority: normal
assignee:
pr:
depends: ["0080-drag-after-tick-crashes"]
---

## Spec

Ticket 0080 moved the reorder surface to mount positions and crosses
to data indexes once, at the drop. The pickup snapshot is frozen. If a
tick's hold ends between pick-up and drop, the regroup lands first, and
the data indexes the drop writes describe the group as it was before
the regroup. `reorderItems` can then apply a no-op or a wrong order.

A related case: a pickup that fires while a regroup's layout effects
are mid-flight can read a mix of old and new indexes. That degrades the
drop's correctness, not its safety.

Another related case: a grip step or a TalkBack increment while another
row's drag is in flight reorders the data under the stale snapshot. The
drop can then write a span against pre-step indexes. The grip path
makes this easier to reach than the old menu. The same fix should
cover it.

Nothing crashes. The user sees a drag that does not move the row, or
moves it to the wrong place.

The fix direction: make the drop conditional on the snapshot still
matching the data. Either cancel the drag when its group's data changes,
or rebase the snapshot by row key and drop only when every key still
exists and the relative order is unchanged. A cancel is the smaller,
safe change. A rebase is better if it can be proven.

## Acceptance

- [ ] A test ticks a task while another row is held, then drops. The
      note is unchanged, or the new order is correct. It never writes a
      wrong order.
- [ ] The drag cancels or rebases, and the user sees which happened.
- [ ] A drop after a stable tick still writes the order (the 0080 case).
- [ ] The reorder tests, the list e2e and the no-crash case pass.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0` and `npx vitest run` pass.

## Outcome

(filled in before moving to done/)
