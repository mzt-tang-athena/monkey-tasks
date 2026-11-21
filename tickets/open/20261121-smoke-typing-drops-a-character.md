---
title: The smoke's typing drops a character
created: 2026-11-21
priority: normal
assignee:
pr:
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

- [ ] A run before the fix drops a key and names the cause.
- [ ] Twenty typing runs in a row keep every character.
- [ ] A mismatch fails the step with both strings printed.

## Outcome

(filled in before moving to done/)
