---
id: 0069
title: Add a verification skill that drives the web preview
created: 2026-11-07
priority: normal
assignee: claude-code
pr:
depends: []
---

## Spec

Agents and reviewers on epic 0047 prove each change by hand. Each run
writes its own Playwright scripts, picks a port, and saves screenshots
in its own place. The phase 3 reviews found real visible regressions
this way (PRs #80 and #81), but the method lives only in each run's
prompt.

Add a project skill, `.claude/skills/verify-monkey-tasks/`, made with
the pstack `create-verification-skill` flow. It launches the web
preview on its own port, checks the instance is ours and current, runs
journey files on the suite's helpers, keeps screenshots, traces and
note text as evidence, and stops only the server it started. A feature
map lists how to drive each user feature, and what the web preview
cannot prove.

## Acceptance

- [ ] `launch.sh` builds and serves the preview, and `doctor.sh` prints four `ok` lines.
- [ ] `drive.sh` runs `journeys/capture.journey.ts` in both motion projects and prints the evidence path.
- [ ] `cleanup.sh` stops the server, and the evidence stays.
- [ ] `features/` has an index and one file each for Lists, Capture, Planner, the task editor and vault sync.
- [ ] Vale prints nothing on the skill's Markdown.

## Outcome

(filled in before moving to done/)
