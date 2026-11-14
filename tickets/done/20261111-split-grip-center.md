---
title: Center the split grip in the still day preview
created: 2026-11-11
priority: normal
assignee:
pr:
depends: []
---

## Spec

The verifier of PR #110 found this at the day commit. The grey
grabber bar sits at the left edge in `SplitStill`, and at the centre
of the divider in the live `Split`. The preview and the landed page
jump horizontally when the page commits.

The cause is the wrapper. The live grip sits inside `styles.gripSlot`,
which is 72 wide and `alignSelf: center`. `SplitStill` puts
`styles.grip` straight into `styles.divider`, and the grip uses
absolute positioning at `left: 0`, so it sits at the left edge.

Fix it by rendering the still grip inside the same `gripSlot` wrapper.
Keep the 44pt target and do not change the live split.

## Acceptance

- [ ] The still preview and the live split put the bar at the same
      horizontal centre.
- [ ] A before and after frame pair shows no horizontal jump at the
      commit.
- [ ] The split tests and the day preview match test pass.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0` and `npx vitest run` pass.

## Outcome

Fixed on 2026-11-11 on `fix/split-grip-center`. Pull request #112.

`SplitStill` rendered the grip outside `gripSlot`. The grip uses
absolute positioning at `left: 0`, so the bar sat at the divider's
left edge. The live split centred it. The preview and the landed
page jumped 144 px horizontally at the commit.

The still grip now sits in the same 72 wide `gripSlot` wrapper. The
bars carry a `testID`, so a Playwright test compares their centres
relative to their roots. The test reads 144 px before the fix and 0
after.

| Check | Result |
|---|---|
| New test, before | fails at 144 px |
| New test, after | passes at 0 px |
| `npx tsc --noEmit` | clean |
| `npx eslint src scripts e2e --max-warnings 0` | clean |
| `npx vitest run` | 80 files, 720 tests, pass at the pinned contracts `fa0d4fc` |
| `pagers.spec.ts` | 55 passed, 0 failed |
