---
title: The tab strip clips a letter at its edge
created: 2026-11-25
priority: low
assignee: claude-lane-tab-strip
pr:
depends: []
---

## Spec

A design frame from 2026-11-25 shows the Lists tab strip scrolled to a
selected tab. The left edge cuts the last letter of the tab before it
("n" of Main). The fade at the start does not draw either. The frame is
`~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/01-a-stacked.png`.

It may be a reduced-motion artifact, so confirm it on the phone first.

- Reproduce it on the emulator, with motion on and off.
- If it shows, fix the edge. Clip on the gap between tabs, or draw
  the fade over a cut letter.
- Check the task editor and the planner for the same edge.

CI saw the same edge on 2026-11-26, on PR #238. The spec at
`lists.spec.ts:220` waits for `tab-fade-start` after a wheel scroll,
and it timed out. A re-run passed. The start fade flakes on the web
too.

## Acceptance

- [ ] Emulator frames show whether it happens with motion on and off.
- [ ] No tab shows a half letter at either edge.
- [ ] The selected tab still scrolls into view.
- [ ] The fade spec passes 20 runs with two workers.

## Outcome

(filled in before moving to done/)
