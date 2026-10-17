# 0001. Standalone mobile app on React Native and Expo

- **Status:** accepted
- **Date:** 2026-10-17

## Context

The tasks and calendar layer must work offline, fire notifications with
the phone closed, and read the vault on the device. Obsidian plugins only
run while Obsidian is open, so they cannot own notifications. A web PWA
served from athena cannot match offline behavior without hand-built sync.

## Decision

We build a standalone Android app with React Native and Expo, structured
by the Bulletproof React feature layout. We install the APK by sideload,
not through a store. We skip Ionic UI components and skip Capacitor.

## Consequences

Native notifications, geofencing, and background work come from
first-party Expo modules rather than community plugins. The app renders
native widgets, so React knowledge transfers but HTML and CSS do not. If a
feature ever needs hand-written Kotlin, Expo prebuild generates the native
project, so nothing is locked in.
