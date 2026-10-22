# 0013. Native gesture library for touch interaction

- **Status:** accepted
- **Date:** 2026-10-21

## Context

Every interaction in the app is hand-rolled. Tab swipes, task drags, and
hover fills run on React Native pointer events. Those events work on web.
React Native 0.88 gates pointer events on Android behind a build flag that
defaults to off. An APK without it ships a dead app. The user picked the
library path.

We also found that touch never fires pointerenter on other views. Touch
holds its pointer on the first target. Drop targeting now hit-tests page
coordinates against registered drop zones on every move. One pointer path
serves mouse and touch on web. Drag sources also set touch-action to none,
so the browser does not hand a drag to a scroller.

## Decision

We add `react-native-gesture-handler`. The Android build routes the
interaction set through it. On web, the pointer path keeps running as is.

## Consequences

One new dependency. It is the same library most Expo apps use for gestures.
The preview and the APK must feel the same; the port at APK time moves the
same gesture rules to the library's API. Nothing in the locked design
changes.

## Amendment, 2026-10-22

The root layout was missing `GestureHandlerRootView`, so `GestureDetector`
never received touches on Android. The root layout now wraps the app in
`GestureHandlerRootView` with `flex: 1`.

