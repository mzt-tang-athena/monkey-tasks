---
title: Launch answers the notification prompt
created: 2026-11-19
priority: normal
assignee: omp
pr: 195
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

- [x] A fresh launch answers the prompt, then waits for rows.
- [x] A fresh launch that works prints no `stopped` line.
- [x] A launch that keeps its data still works with no prompt.
- [x] The gotcha line in the verify skill matches the new behavior.

## Outcome

A fresh launch lost 90 s and printed `stopped at line 160` because the
data clear took the notification grant with it. The app then asked on
its first vault read, and the prompt covered the row wait.

Launch now grants `POST_NOTIFICATIONS` right after `pm clear`. The
prompt never shows, so there is nothing to answer. The release smoke's
prompt step went with it. The verify skill's gotcha line says what a
clear costs and what launch restores.

Proven on the emulator on 2026-11-20, on port 5580 with a swapped
release APK (`android-apk.sh`, mode swap):

- `FRESH=1`: ready at 120 s, 0 `stopped` lines, no prompt, 5 rows.
  Shot `android-20261120-053007/launch.png`.
- Kept data: ready at 28 s, 0 `stopped` lines, no prompt, 5 rows.
  Shot `android-20261120-053213/launch.png`.
- `dumpsys package`: `POST_NOTIFICATIONS: granted=true`.

The full local gate passed at the code head. PR 195.
