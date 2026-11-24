---
title: The theme picker tells TalkBack which theme is on
created: 2026-11-24
priority: normal
assignee:
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

- Find where it drops: React Native's mapping of `aria-checked`, or
  the dump reading the wrong attribute.
- Fix it at that layer, so every radio in the app gets it.
- Check the week-start setting for the same gap.

## Acceptance

- [ ] The Android dump shows `checked="true"` on the active theme.
- [ ] An e2e test fails if no option reports its checked state.

## Outcome

(filled in before moving to done/)
