---
title: Twelve Expo packages sit behind the SDK patches
created: 2026-11-24
priority: normal
assignee:
pr:
depends: []
---

## Spec

`npx expo-doctor` fails on main. It names 12 packages that sit behind
the patch versions Expo SDK 58 expects. The icon lane saw it on
2026-11-24 and left it alone.

- Run `npx expo install --fix` from `app/`, as `app/AGENTS.md` says.
- Read the changelog of each package that moves, and name any change
  a user could see.
- Prove the app still works: the full gate, then the release smoke on
  a fresh APK.

## Acceptance

- [ ] `npx expo-doctor` passes on the branch.
- [ ] The PR lists each package that moved, old and new version.
- [ ] The full gate and the release smoke pass on the branch.

## Outcome

(filled in before moving to done/)
