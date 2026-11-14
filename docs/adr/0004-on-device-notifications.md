# 0004. Notifications fire on the device

- **Status:** accepted
- **Date:** 2026-10-17

## Context

Reminders must fire with the phone asleep and the server down. A server
push cannot reach a phone that is offline, and Obsidian plugins only run
while Obsidian is open.

## Decision

The app schedules notifications through the OS alarm mechanism, on the
phone. The device evaluates recurrence. An ntfy fallback from athena
stays out of scope for the first version.

## Consequences

Reminder delivery never depends on athena or Obsidian. Location triggers
later use the same on-device path through geofencing. We verify reboot
behavior for scheduled notifications during the spike. That is the one
platform detail we have not tested.

Amendment 2026-10-19: the spike verified every item above on a
Xiaomi-family ROM with one caveat. When the app is merely backgrounded,
scheduled alarms survive reboot. When a swipe-away closes the app, the ROM
treats it as a force-stop and never delivers `BOOT_COMPLETED`. The phone
loses stored alarms until the app opens again. The mitigation is app-side
and already planned: the app rescans the vault and re-schedules
notifications on every open. No change to the decision.
