---
title: Closing the reference picker keeps the keyboard
created: 2026-11-26
priority: normal
assignee:
pr:
depends: []
---

## Spec

The operator's feedback on 2026-11-26. In capture, the operator opens
the reference control, links nothing, and taps Done. The keyboard goes
away. They want it to stay, with the cursor in the main capture box, so
they can keep typing.

- Done or a cancel returns focus to the capture box, keyboard up.
- Linking a reference returns focus the same way.

## Acceptance

- [ ] Done with no link leaves the keyboard up in the capture box.
- [ ] Linking a reference also returns focus to the capture box.
- [ ] Emulator frames with the operator's keyboard path.

## Outcome

(filled in before moving to done/)
