---
title: The tab strip clips a letter at its edge
created: 2026-11-25
priority: low
assignee: claude-lane-tab-strip
pr: 253
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

- [x] Emulator frames show whether it happens with motion on and off.
- [x] No tab shows a half letter at either edge.
- [x] The selected tab still scrolls into view.
- [x] The fade spec passes 20 runs with two workers.

## Outcome

The cut letter was real, with motion on and off. The fade was a
30 px ramp over the text. It ended inside a letter wherever a tab
sat under the edge ("s" of Errands, "R" of Reading).

- The fade now ends on the gap between two tabs.
- A solid cover hides every cut tab, then a short ramp follows.
- The task editor's chip row shares the fade, so it got the fix.
- The planner has no fade. Its rail cuts at the display on purpose.
- The selected tab scrolls in with the name before it just clear.

The web flake had its own cause. The strip first draws Today and
Main. The end fade drew before the strip had a size. The spec
passed that check early and wheeled a strip with nothing to
scroll. It never saw the start fade. The fade now waits for a
size, and the spec waits for the lists.

Frames and logs: `~/code/monkey-tasks/worktrees/evidence-tab-strip-edge/`.
