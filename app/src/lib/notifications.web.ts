import type * as Native from "./notifications";

/**
 * The browser preview has no alarm API. Metro takes this file for the
 * web build in place of `notifications.ts`, so the web bundle never
 * loads expo-notifications and the console stays clean. Every call is a
 * quiet no-op, and the alarm state reads empty.
 */
export const alarmsSupported = false;

export const ensureNotificationPermission: typeof Native.ensureNotificationPermission =
  async () => false;

export const scheduleAt: typeof Native.scheduleAt = async () => {
  throw new Error("alarms are not available on the web");
};

export const cancelAllScheduled: typeof Native.cancelAllScheduled = async () =>
  undefined;

export const cancelScheduled: typeof Native.cancelScheduled = async () =>
  undefined;

export const listScheduled: typeof Native.listScheduled = async () => [];

export const exactAlarmState: typeof Native.exactAlarmState = async () => false;
