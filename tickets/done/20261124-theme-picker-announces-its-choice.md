---
title: The theme picker tells TalkBack which theme is on
created: 2026-11-24
priority: normal
assignee: lane-theme-checked-a11y
pr: 237
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

- [x] A dump on the base shows both radios unchecked.
- [x] The Android dump shows `checked="true"` on the active theme.
- [x] An e2e test fails if no option reports its checked state.

## Outcome

Shipped in #237.

A fresh dump on the base showed all four radios `checkable="false"
checked="false"`. The cause was the guessed one. RNGH's `Pressable`
hands its props to a native button view, which reads
`accessibilityState`. React Native's `View` translates `aria-checked`
and `aria-selected` in JavaScript. The shared press did not.

`pressable.tsx` now maps both aliases into `accessibilityState` on
native. An explicit state still wins over an alias, as `View`
decides it. A unit test pins the mapping. Every native press gets it,
including the task row's tick, which now reports its check state.

The week-start setting had the same gap through `aria-selected`. A dump
shows Monday selected, then Sunday after a tap. The themed switch
already passed `accessibilityState`. It reads the same before and after.

The base dump and both fixed dumps live in
`~/code/monkey-tasks/worktrees/evidence-theme-checked-a11y/`. The web
e2e in `app/e2e/specs/settings.spec.ts` asserts the checked radio and
fails when none reports it.
