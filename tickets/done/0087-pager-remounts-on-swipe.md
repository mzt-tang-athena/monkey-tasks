---
id: 0087
title: A day or month swipe remounts the page
created: 2026-11-11
priority: high
assignee: omp
pr: 110
depends: []
---

## Spec

Every day swipe on the Planner and every month swipe rebuilds the
page. The day list loses its scroll position and every row renders
from scratch.

The cause is `app/src/components/motion/pager.tsx:204`:

```tsx
<View key={`live:${index}`} testID="pager-live" style={fill && styles.fill}>
```

`live` equals `index - origin`, so the key changes on every commit.
React unmounts the whole live subtree and mounts a new one. Ticket
0079 put the live page at the track's origin and left the track at 0 at
rest, so the key is no longer needed to avoid a flash.

Measure first. Count mounts of `DayPage` and `MonthGrid` across a
swipe on head, for example with a mount counter in a test harness. The
test asserts one mount for the first page and no new mount for a swipe
to a neighbour. It fails on head and passes after the fix.

The commit must swap the page content and the track position in one
frame. A removed key must not show the previous page for a frame, a
blank strip, or a vertical shift. Prove it with a frame grid from the
verify skill, motion on and reduced motion.

Check the Lists pager too. It shares the surface, so a tab tap should
keep each page's scroll position when the user returns to it. If
keeping state across tabs is not wanted there, say so in the ticket
and keep the day and month fix.

## Acceptance

- [x] A mount counter shows the live page mounting once per commit on
      head and not remounting on a swipe after the fix.
- [x] The day list keeps its scroll position across a swipe and back.
- [x] A frame grid shows the neighbour sliding in, the commit at 0, no
      flash, no blank strip and no vertical shift, motion on and
      reduced motion.
- [x] The pager scenarios and the full e2e suite pass. No retries.
- [x] No stale page content after the commit.

## Outcome

Fixed on 2026-11-11 on `perf/0087-pager-remount`. Pull request #110.

The live page remounted because its View keyed on `index`. A test child
counted 2 mounts across one swipe on head. It counts 1 after the fix.

The same probe found a second fault at the commit. Since ticket 0079
the live page lays out at the track's origin, and the track's transform
carries the whole page position. That transform came from a shared
value, so it updated one frame after React swapped the content. On head
the commit frame showed Tuesday 27 at an offset of -352 px with no
preview, which is a blank strip. Now the live page carries its own
`live × width` as a plain style, and the track moves through page
space. The content and the place change in one React render. No frame
shows the old page in place or a blank strip.

The day keeps its scroll. The neighbour preview draws at the live
panes' offsets, so the landed page matches what the swipe showed. The
browser's scroll anchor can move the offset by less than a row when a
changed row sits above it. It never returns to the top.

A list tab is a different list. Its inner list still starts at the top,
as its preview draws it. A tab tap does not restore the previous tab's
scroll. Per-tab memory is a separate change.

| Check | Result |
|---|---|
| Live page mounts across one swipe | 2 before, 1 after |
| `pagers.spec.ts` | 54 passed, 14 skipped, 0 failed |
| `npx tsc --noEmit` | clean |
| `npx eslint src scripts e2e --max-warnings 0` | clean |
| `npx vitest run` | 80 files, 720 tests, all pass |
| `E2E_PORT=8587 npm run e2e` | 369 passed, 25 skipped, 0 failed, no retries |

Frame evidence in `/tmp/opencode/0087/`:

- `day-motion-hold.png`, `day-motion-frame-00..23.png` and
  `day-motion-landed.png` show the neighbour sliding in, then the
  commit at frame 13 with Tuesday 27 at the pager's origin.
- `day-reduced-*` shows the same end state with reduce motion. The
  commit is frame 0.
- `month-motion-*` and `month-reduced-*` show October to November.
  The commit is frame 14 with motion and frame 0 with reduce motion.
- `*-frames.json` holds the track position, live offset, preview count
  and heading per frame. No frame has no preview and a live page off
  its origin.

`pagers.spec.ts` asserts the one-frame commit in "a day swipe swaps the
page and its place in one frame" and its month twin. The day scroll
and the preview match are asserted by "the day preview matches the
landed page" with the mouse and touch.

Not proven: the native Android frames. The web suite cannot show
UI-thread animation timing there.
