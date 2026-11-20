---
title: Launch answers the notification prompt
created: 2026-11-19
priority: normal
assignee: omp
pr:
depends: []
---

## Spec

With `FRESH=1`, `android-launch.sh` clears the app data, so Android asks
for the notification permission again. The prompt covers the app.
Launch then waits 90 s for a task row, fails, and prints
`android-launch: stopped at line 160`.

The callers answer the prompt afterwards, and the run goes on. Each
fresh launch loses 90 s and prints a failure that is not one. The 1.2
release pass hit it on both launches (`android-20261119-082158` and
`android-20261119-082943`).

The skill's gotcha list documents the prompt. Launch should answer it
instead, before it waits for rows.

## Acceptance

- [ ] A fresh launch answers the prompt, then waits for rows.
- [ ] A fresh launch that works prints no `stopped` line.
- [ ] A launch that keeps its data still works with no prompt.
- [ ] The gotcha line in the verify skill matches the new behavior.

## Outcome

(filled in before moving to done/)
