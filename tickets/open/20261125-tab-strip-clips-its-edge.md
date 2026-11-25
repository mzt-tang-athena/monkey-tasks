---
title: The tab strip clips a letter at its edge
created: 2026-11-25
priority: low
assignee:
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

## Acceptance

- [ ] Emulator frames show whether it happens with motion on and off.
- [ ] No tab shows a half letter at either edge.
- [ ] The selected tab still scrolls into view.

## Outcome

(filled in before moving to done/)
