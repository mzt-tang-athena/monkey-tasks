---
id: 0087
title: A day or month swipe remounts the page
created: 2026-11-11
priority: high
assignee: omp
pr:
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

- [ ] A mount counter shows the live page mounting once per commit on
      head and not remounting on a swipe after the fix.
- [ ] The day list keeps its scroll position across a swipe and back.
- [ ] A frame grid shows the neighbour sliding in, the commit at 0, no
      flash, no blank strip and no vertical shift, motion on and
      reduced motion.
- [ ] The pager scenarios and the full e2e suite pass. No retries.
- [ ] No stale page content after the commit.

## Outcome

(filled in before moving to done/)
