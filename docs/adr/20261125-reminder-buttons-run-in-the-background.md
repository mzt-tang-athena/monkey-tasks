# 20261125. A reminder's buttons run in a background task

- **Status:** accepted
- **Date:** 2026-11-25

## Context

The operator wants Done and Reschedule on a reminder, as TickTick and Google
Tasks have. The buttons must work with the app closed or killed. Today a
tap on a reminder only opens the app.

Android runs a button press in the app's process, with no screen. Expo can
hand that press to a JavaScript task. The task needs `expo-task-manager`,
which is a native module. The bundle must define the task as it loads,
before any screen.

The write itself is the same as an in-app tick. The vault is a folder the
user granted through Android's Storage Access Framework (SAF). We did not
know if a task with no screen could still read and write it.

## Decision

We run each press in one background task. The app uses the same code when it
is open.

- The buttons stay in the background. They do not open the app.
- The Done and Reschedule writes are plain functions of a vault adapter. The
  list's tick and the button both call them, so a note changes the same way.
- `app/index.ts` is the entry file. It loads the task, then loads
  `expo-router/entry`.
- A press acts once. A file records each press.
- Android can hand one press to the task and to the open app. It can
  also replay a press later.
- A press that fails leaves the note and the reminder as they were.
  It posts a notification and keeps a record.
- The app lists the record when it opens, with a Retry.
- A ring scheduled before this change has no buttons. A rebuild replaces it.

We rejected opening the app on a press. That is simpler. It also breaks
the promise that a press costs no screen time.

## Consequences

- A press works with the app killed.
- A slow phone can take a few seconds, because no screen is up.
- The change adds a native module. The phone needs a new APK, not an update.
- A press from a killed app has no screen to fail on. The notification and the
  record carry the failure instead.
- Two presses in a row run one after the other, so a repeating task makes one
  next note.
- We cannot test the task from the web preview. The emulator proves it.
