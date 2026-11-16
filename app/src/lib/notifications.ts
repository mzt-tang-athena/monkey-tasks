import * as Notifications from "expo-notifications";
import {
  AndroidAudioContentType,
  AndroidAudioUsage,
  AndroidImportance,
} from "expo-notifications";
import type { AlertWeight } from "@monkey-tasks/schemas";
import type { AlertRing } from "@/lib/alerts/rings";

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
};

export type RingNotification = { id: string; data: RingData | null };

export type AlertResponse = { uri: string; base?: number };

export type AlertResponseSubscription = { remove(): void };

const HARSH_CHANNEL = "reminders-harsh";
const QUIET_CHANNEL = "reminders-quiet";
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

async function createChannels(): Promise<void> {
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
      },
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
  const { uri, base, step, weight } = content.data ?? {};
  return typeof uri === "string" &&
    typeof base === "number" &&
    typeof step === "number" &&
    (weight === "harsh" || weight === "quiet")
    ? { uri, base, step, weight }
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

function readResponse(
  response: Notifications.NotificationResponse | null,
): AlertResponse | null {
  if (response == null) {
    return null;
  }
  const data = response.notification.request.content.data;
  if (typeof data?.uri !== "string") {
    return null;
  }
  return typeof data.base === "number"
    ? { uri: data.uri, base: data.base }
    : { uri: data.uri };
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
