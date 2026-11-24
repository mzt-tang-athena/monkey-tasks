---
title: The verify scripts refuse an emulator port above 5584
created: 2026-11-24
priority: normal
assignee:
pr:
depends: []
---

## Spec

On this box, adb loses an emulator whose console port sits above 5584.
The icon lane's run on 5586 died on 2026-11-24, and the same run on
5576 worked. Lanes pick their own `ANDROID_VERIFY_PORT`, so the next
one to pick 5586 loses an hour.

- Find the cause first: the adb server's port scan range, or a clash
  with another listener on the box.
- If the limit is real, `android-env.sh` refuses a port above it with
  a line that names the cause. An odd port gets refused too, since the
  console takes the even one.
- The verify skill names the usable range.

## Acceptance

- [ ] A run on a high port shows the cause.
- [ ] A port above the limit fails at once, with the reason.
- [ ] The skill names the usable ports.

## Outcome

(filled in before moving to done/)
