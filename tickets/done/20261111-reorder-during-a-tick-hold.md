---
title: A tick that lands mid-drag leaves the drop stale
created: 2026-11-11
priority: normal
assignee: omp
pr: 214
depends: ["0080-drag-after-tick-crashes"]
---

## Spec

Ticket 0080 moved the reorder surface to mount positions and crosses
to data indexes once, at the drop. The pickup snapshot freezes at
pick-up. If a tick's hold ends between pick-up and drop, the regroup
lands first. The data indexes the drop writes then describe the group
before the regroup. `reorderItems` can then apply a no-op or a wrong
order.

A related case: a pickup can fire while a regroup's layout effects are
mid-flight. It can then read a mix of old and new indexes. That costs
the drop its correctness. It does not cost the drop its safety.

Another related case: a grip step or a TalkBack increment can run while
another row's drag is in flight. It then reorders the data under the
stale snapshot. The drop can then write a span against the indexes from
before the step. The grip path makes this easier to reach than the old
menu. The same fix should cover it.

Nothing crashes. The user sees a drag that does not move the row, or
moves it to the wrong place.

The fix direction: make the drop conditional on the snapshot still
matching the data. Either cancel the drag when its group's data changes,
or rebase the snapshot by row key. A rebase then drops only when every
key still exists and the relative order stays the same. A cancel is the
smaller, safe change. A rebase is better when proof exists.

## Acceptance

- [x] A test ticks a task while another row stays held, then drops. The
      note keeps its old text, or the new order is correct. It never
      writes a wrong order.
- [x] The drag cancels or rebases, and the user sees which happened.
- [x] A drop after a stable tick still writes the order (the 0080 case).
- [x] The reorder tests, the list e2e and the no-crash case pass.
- [x] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0` and `npx vitest run` pass.

## Outcome

Fixed on 2026-11-24 on `fix/reorder-during-a-tick-hold`. Pull request
#214.

The drop now reads the group again at the release. `rebaseSpan` maps
the pickup row keys onto the group's data indexes as they stand. A row
that left since pick-up moves nobody. A drop cancels when its
picked row left, or when the rows that remain no longer keep their
pickup order. The row springs back, and no note changes. The ADR
`20261124-a-drop-rebases-on-the-rows-it-shows` records both. It also
records the one-commit window where the registry lags.

The repro: five rows, drag the fourth to the top, tick the second, let
its hold end, then drop. The base wrote `order: 1` on the fifth row and
left the dragged row at 4. Head puts the dragged row first. A test in
`lists-screen.test.tsx` holds the repro, and `reorder.spec.ts` runs the
same race in a browser, in both motion projects.

The spec's third case cancels: a grip step or a TalkBack increment
under a held drag. The old indexes can write a passable order there,
but the drag's shifts still come from the pickup layout.

Next: nothing. A JS hand-off at the release would close the one-commit
window. No surface needs it yet.
