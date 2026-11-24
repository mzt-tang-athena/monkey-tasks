---
title: The smoke's typing drops a character
created: 2026-11-21
priority: normal
assignee: opencode
pr: 215
depends: []
---

## Spec

One release smoke pass on 2026-11-21 lost a character in the journal
and Inbox fields. `android-drive.sh` types with `adb shell input text`
into a controlled React Native field. A fast key can arrive while the
field re-renders, and the field then drops it. The rerun passed, so the
smoke is flaky here.

- Find why the key drops: the controlled value, or the input rate.
- Fix the typing helper, not each step. Paste or type key by key with
  a read-back are both fair options. Weigh them in the PR.
- The helper reads the field back and fails on a mismatch.

## Acceptance

- [x] A run before the fix drops a key and names the cause.
- [x] Twenty typing runs in a row keep every character.
- [x] A mismatch fails the step with both strings printed.

## Outcome

`android-drive.sh type` now sends one key per `input text` and reads the
focused field back.

- Cause: a controlled field drops the tail of a key burst. The base
  helper lost the tail in 20 of 20 rounds. One key per call at 0.15 s
  kept every character in 5 of 5.
- At this head, 20 short rounds and 3 long ones kept every character. A
  mismatch prints both strings and exits 1.
- The smoke's three typing steps now FAIL when the field does not read
  back. The skill documents the pacing and the new verb.
