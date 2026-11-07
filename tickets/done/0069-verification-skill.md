---
id: 0069
title: Add a verification skill that drives the web preview
created: 2026-11-07
priority: normal
assignee: claude-code
pr: 87
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

- [x] `launch.sh` builds and serves the preview, and `doctor.sh` prints four `ok` lines.
- [x] `drive.sh` runs `journeys/capture.journey.ts` in both motion projects and prints the evidence path.
- [x] `cleanup.sh` stops the server, and the evidence stays.
- [x] `features/` has an index and one file each for Lists, Capture, Planner, the task editor and vault sync.
- [x] Vale prints nothing on the skill's Markdown.

## Outcome

Done. The skill lives in `.claude/skills/verify-monkey-tasks/`.

The proof run on `7c079a2`: `launch.sh` exported and served on port
8300 in about 45 s, and `doctor.sh` printed four `ok` lines.
`drive.sh` ran the capture journey in `motion` and `reduced-motion`,
and both passed. Each kept four named screenshots, a trace and the
note text. `cleanup.sh` stopped the server, Doctor then failed on the
closed port as it should, and the screenshots were still in
`app/build/verify/evidence/`.

The first run found three bugs in the helpers, all fixed before the
commit: a wrong path to Doctor after `cd`, a Doctor line that printed
both `ok` and `FAIL`, and an HTML report folder that would wipe the
evidence. The landed-row screenshot first showed the top of the list,
so the journey now scrolls the row into view.

Left: the web preview cannot prove UI-thread motion, native gestures,
keyboard insets, SAF or notifications. The skill says so. An Android
emulator would close that gap, but this machine has no SDK and the
user is not in the `kvm` group.

PR #86 ignores `.claude/` except `.claude/workflows/`. When it merges,
add `!.claude/skills/` beside that line, or new skill files stay
untracked.
