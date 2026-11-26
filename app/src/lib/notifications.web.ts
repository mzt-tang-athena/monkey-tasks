import type * as Native from "./notifications";

/**
 * The browser preview has no alarm API. Metro takes this file for the
 * web build in place of `notifications.ts`, so the web bundle never
 * loads expo-notifications and the console stays clean. Every call is a
 * quiet no-op, and the alarm state reads empty.
 */
export const alarmsSupported = false;

export type {
  AlertResponse,
  AlertResponseSubscription,
  RingData,
  RingNotification,
} from "./notifications";

export const ensureNotificationPermission: typeof Native.ensureNotificationPermission =
  async () => false;

export const ensureChannels: typeof Native.ensureChannels = async () =>
  undefined;

export const scheduleRing: typeof Native.scheduleRing = async () => {
  throw new Error("alarms are not available on the web");
};

export const cancelScheduled: typeof Native.cancelScheduled = async () =>
  undefined;

export const listScheduledDetailed: typeof Native.listScheduledDetailed =
  async () => [];

export const listDeliveredDetailed: typeof Native.listDeliveredDetailed =
  async () => [];

export const dismissDelivered: typeof Native.dismissDelivered = async () =>
  undefined;

export const listScheduled: typeof Native.listScheduled = async () => [];

export const exactAlarmState: typeof Native.exactAlarmState = async () => false;

export const askExactAlarms: typeof Native.askExactAlarms = async () => undefined;

export const takeAlertResponse: typeof Native.takeAlertResponse = () => null;

export const addAlertResponseListener: typeof Native.addAlertResponseListener =
  () => ({ remove() {} });

export const readTaskResponse: typeof Native.readTaskResponse = () => null;

export const postActionFailure: typeof Native.postActionFailure =
  async () => undefined;

export const clearActionFailureNotice: typeof Native.clearActionFailureNotice =
  async () => undefined;

export const isButtonPayload: typeof Native.isButtonPayload = () => false;
