---
title: Closing the reference picker keeps the keyboard
created: 2026-11-26
priority: normal
assignee: opencode
pr: 243
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

- [x] Done with no link leaves the keyboard up in the capture box.
- [x] Linking a reference also returns focus to the capture box.
- [x] Emulator frames with the operator's keyboard path.

## Outcome

Shipped in #243. The reference picker returns the caret to the capture
input on Done, on a cancel and after a link. It does this on web and
Android. The keyboard stays up, so the operator keeps typing. The web e2e reads
focus in both motion modes, and the emulator journey reads the focused
field after each Done.
