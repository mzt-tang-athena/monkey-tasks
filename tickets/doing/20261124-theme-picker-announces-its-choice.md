---
title: The theme picker tells TalkBack which theme is on
created: 2026-11-24
priority: normal
assignee: lane-theme-checked-a11y
pr:
depends: []
---

## Spec

On 2026-11-24 the release smoke dumped the Settings screen on Android.
Both theme radios read `checked="false"`, whichever palette is on. A
TalkBack user hears two unchecked options and can't tell which theme
is in use.

The picker already sets `role="radio"` and a checked state, and a unit
test proves it on the web. The state does not reach Android's
accessibility tree.

The dump left with the smoke lane's worktree, so reproduce it first.
A likely cause: React Native maps `aria-checked` to Android's checked
state in `View`, but `pressable.tsx` routes native presses through
react-native-gesture-handler's `Pressable`. That one spreads
`aria-checked` onto its host without the mapping.

- Reproduce with a fresh dump, and keep it as evidence.
- Find where it drops: the gesture handler's `Pressable`, or the dump
  reading the wrong attribute.
- Fix it at that layer, so every radio in the app gets it.
- Check the week-start setting for the same gap.

## Acceptance

- [ ] A dump on the base shows both radios unchecked.
- [ ] The Android dump shows `checked="true"` on the active theme.
- [ ] An e2e test fails if no option reports its checked state.

## Outcome

(filled in before moving to done/)
