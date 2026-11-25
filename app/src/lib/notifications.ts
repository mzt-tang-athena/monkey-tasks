import * as Notifications from "expo-notifications";
import {
  AndroidAudioContentType,
  AndroidAudioUsage,
  AndroidImportance,
} from "expo-notifications";
import type { AlertWeight } from "@monkey-tasks/schemas";
import type { AlertRing } from "@/lib/alerts/rings";
import { DONE_BUTTON } from "@/lib/alerts/actions";
import { RESCHEDULE_CHOICES } from "@/lib/alerts/choices";

/**
 * The phone's alarms. The web build takes `notifications.web.ts`
 * instead, where every call is a no-op.
 */
export const alarmsSupported = true;

export type RingData = {
  uri: string;
  base: number;
  step: number;
  weight: AlertWeight;
  /** True when the ring carries the Done and Reschedule buttons. */
  buttons: boolean;
};

export type RingNotification = { id: string; data: RingData | null };

/**
 * A tap on a reminder. `button` is the identifier of a Done or
 * Reschedule button, absent for a tap on the notification itself. `key`
 * names the press, so one press acts once.
 */
export type AlertResponse = {
  uri: string;
  base?: number;
  button?: string;
  /** The notification's title: the task's name. */
  name: string;
  key: string;
};

export type AlertResponseSubscription = { remove(): void };

const HARSH_CHANNEL = "reminders-harsh";
const QUIET_CHANNEL = "reminders-quiet";
const REMINDER_CATEGORY = "reminder";
const FAILURE_PREFIX = "action-failed:";
// Android freezes a channel's settings at creation, so the old one is
// deleted and never reused.
const OLD_CHANNEL = "reminders";

// A harsh alert rings while the app is open; a quiet one only shows.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound:
      notification.request.content.data?.weight === "harsh",
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) {
    return true;
  }
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

let channels: Promise<void> | null = null;

/**
 * Both channels, created once. The promise is kept so two rings in one
 * turn do not race the settings calls. The first vault read calls this,
 * so the old `reminders` channel goes without waiting for an alert.
 */
export function ensureChannels(): Promise<void> {
  channels ??= createChannels().catch((error: unknown) => {
    channels = null;
    throw error;
  });
  return channels;
}

async function createCategory(): Promise<void> {
  // The buttons stay in the background: a press from a killed app runs
  // the background task and never opens the app.
  const options = { opensAppToForeground: false };
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
    { identifier: DONE_BUTTON, buttonTitle: "Done", options },
    ...RESCHEDULE_CHOICES.map((choice) => ({
      identifier: choice.id,
      buttonTitle: choice.title,
      options,
    })),
  ]);
}

async function createChannels(): Promise<void> {
  await createCategory();
  await Notifications.deleteNotificationChannelAsync(OLD_CHANNEL);
  await Notifications.setNotificationChannelAsync(HARSH_CHANNEL, {
    name: "Harsh reminders",
    description: "A need: rings on the alarm stream and past Do Not Disturb.",
    importance: AndroidImportance.MAX,
    sound: "default",
    enableVibrate: true,
    bypassDnd: true,
    audioAttributes: {
      usage: AndroidAudioUsage.ALARM,
      contentType: AndroidAudioContentType.SONIFICATION,
    },
  });
  await Notifications.setNotificationChannelAsync(QUIET_CHANNEL, {
    name: "Quiet reminders",
    description: "A cue: silent and easy to clear.",
    importance: AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: false,
    bypassDnd: false,
  });
}

/**
 * Schedule one ring under its own id. A harsh first ring uses alarm
 * clock delivery, so it survives a reboot and the ringer being silent;
 * its follow-ups use best effort, so the phone shows one alarm icon.
 */
export async function scheduleRing(ring: AlertRing): Promise<string> {
  const granted = await ensureNotificationPermission();
  if (!granted) {
    throw new Error("notification permission not granted");
  }
  await ensureChannels();
  const harsh = ring.weight === "harsh";
  await Notifications.scheduleNotificationAsync({
    identifier: ring.id,
    content: {
      title: ring.title,
      body: ring.body,
      data: {
        uri: ring.uri,
        weight: ring.weight,
        base: ring.base,
        step: ring.step,
        buttons: true,
      },
      categoryIdentifier: REMINDER_CATEGORY,
      sticky: harsh,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(ring.when),
      channelId: harsh ? HARSH_CHANNEL : QUIET_CHANNEL,
      delivery: ring.step === 0 && harsh ? "alarmClock" : "bestEffort",
    },
  });
  return ring.id;
}

function ringData(content: {
  data?: Record<string, unknown>;
}): RingData | null {
  const { uri, base, step, weight, buttons } = content.data ?? {};
  return typeof uri === "string" &&
    typeof base === "number" &&
    typeof step === "number" &&
    (weight === "harsh" || weight === "quiet")
    ? { uri, base, step, weight, buttons: buttons === true }
    : null;
}

export async function cancelScheduled(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function listScheduledDetailed(): Promise<RingNotification[]> {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  return requests.map((request) => ({
    id: request.identifier,
    data: ringData(request.content),
  }));
}

export async function listDeliveredDetailed(): Promise<RingNotification[]> {
  const shown = await Notifications.getPresentedNotificationsAsync();
  return shown.map((notification) => ({
    id: notification.request.identifier,
    data: ringData(notification.request.content),
  }));
}

export async function dismissDelivered(ids: readonly string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.dismissNotificationAsync(id)));
}

/** Every scheduled notification, for the diagnostics screen. */
export async function listScheduled(): Promise<
  { id: string; title?: string; when?: number }[]
> {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  return requests.map((request) => {
    const trigger = request.trigger as { date?: number | Date } | null;
    const when =
      trigger && "date" in trigger
        ? new Date(trigger.date as string | number).getTime()
        : undefined;
    return {
      id: request.identifier,
      title: request.content.title ?? undefined,
      when,
    };
  });
}

export async function exactAlarmState(): Promise<boolean> {
  const exact = await Notifications.getExactAlarmPermissionsAsync();
  return exact.granted;
}

/**
 * The notification's data. A response from the background task carries
 * it as JSON text in `dataString`, because only the listener path turns
 * that text into an object.
 */
function contentData(content: {
  data?: unknown;
  dataString?: unknown;
}): Record<string, unknown> | undefined {
  if (content.data != null && typeof content.data === "object") {
    return content.data as Record<string, unknown>;
  }
  if (typeof content.dataString !== "string") {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(content.dataString);
    return parsed != null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function readResponse(
  response: Notifications.NotificationResponse | null,
): AlertResponse | null {
  if (response == null) {
    return null;
  }
  const { request } = response.notification;
  const data = contentData(request.content);
  if (typeof data?.uri !== "string") {
    return null;
  }
  const alert: AlertResponse = {
    uri: data.uri,
    name: request.content.title ?? "",
    key: `${request.identifier}|${response.actionIdentifier}`,
  };
  if (typeof data.base === "number") {
    alert.base = data.base;
  }
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    alert.button = response.actionIdentifier;
  }
  return alert;
}

/** Whether a payload is a tap on one of the buttons. */
export function isButtonPayload(payload: unknown): boolean {
  return (
    payload != null &&
    typeof payload === "object" &&
    "actionIdentifier" in payload &&
    payload.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
  );
}

/** The press a background task was handed, read from its payload. */
export function readTaskResponse(payload: unknown): AlertResponse | null {
  if (
    payload == null ||
    typeof payload !== "object" ||
    !("actionIdentifier" in payload) ||
    !("notification" in payload)
  ) {
    return null;
  }
  return readResponse(payload as Notifications.NotificationResponse);
}

/**
 * Tell the user a button press did not reach the vault. The note is
 * still the way it was, and the reminder stays in the tray.
 */
export async function postActionFailure(input: {
  id: string;
  title: string;
  body: string;
  uri?: string;
}): Promise<void> {
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    identifier: `${FAILURE_PREFIX}${input.id}`,
    content: {
      title: input.title,
      body: input.body,
      data: input.uri == null ? {} : { uri: input.uri },
    },
    trigger: { channelId: QUIET_CHANNEL },
  });
}

export async function clearActionFailureNotice(id: string): Promise<void> {
  await Notifications.dismissNotificationAsync(`${FAILURE_PREFIX}${id}`);
}

/**
 * The tap that started the app, if any. Reading it clears it, so a
 * remount does not open the same task twice.
 */
export function takeAlertResponse(): AlertResponse | null {
  const response = Notifications.getLastNotificationResponse();
  Notifications.clearLastNotificationResponse();
  return readResponse(response);
}

export function addAlertResponseListener(
  listener: (response: AlertResponse) => void,
): AlertResponseSubscription {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const alert = readResponse(response);
      if (alert != null) {
        listener(alert);
      }
    },
  );
  return subscription;
}
