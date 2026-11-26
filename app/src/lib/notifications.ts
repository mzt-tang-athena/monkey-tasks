import * as Notifications from "expo-notifications";
import {
  AndroidAudioContentType,
  AndroidAudioUsage,
  AndroidImportance,
} from "expo-notifications";
import AlarmAccess from "alarm-access";
import type { AlertWeight } from "@monkey-tasks/schemas";
import type { AlertRing } from "@/lib/alerts/rings";
import {
  DONE_BUTTON,
  DROP_BUTTON,
  SNOOZE_BUTTON,
} from "@/lib/alerts/actions";
import type { ButtonSet } from "@/lib/alerts/choices";

/**
 * The phone's alarms. The web build takes `notifications.web.ts`
 * instead, where every call is a no-op.
 */
export const alarmsSupported = true;

export type RingData = {
  uri: string;
  base: number;
  weight: AlertWeight;
  /** Which buttons the ring carries. */
  buttons: ButtonSet;
};

export type RingNotification = { id: string; data: RingData | null };

/**
 * A tap on a reminder. `button` is the identifier of one of its
 * buttons, absent for a tap on the notification itself. `key`
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

// Android freezes a channel's sound at creation, and restores it when a
// deleted id comes back. A new sound needs a new id. The ids no build uses
// go in STALE_CHANNELS, so the phone's settings show only live channels.
const NORMAL_CHANNEL = "reminder-normal";
// Android keeps a channel's Do Not Disturb bypass only when the app holds
// Do Not Disturb access as it makes the channel, and never adds it later.
// So the alarm has one id per state of that access, and the other id goes.
const ALARM_CHANNEL = "reminder-alarm";
const ALARM_CHANNEL_WITH_DND = "reminder-alarm-dnd";
const STALE_CHANNELS = [
  "reminders",
  "reminders-harsh",
  "reminders-quiet",
];
// The expo-notifications plugin copies assets/sounds/alarm.wav to res/raw.
const ALARM_SOUND = "alarm.wav";
// A category identifier holds no ":" and no "-". Android freezes a
// reminder's buttons when it is scheduled, so a new set takes a new id,
// and a ring still on an older id is scheduled again (see rearmRings).
const OLDER_CATEGORIES = ["reminder", "reminderdone"];
const CATEGORIES: Record<ButtonSet, string> = {
  full: "reminderactions",
  allday: "reminderalldayactions",
};
const FAILURE_PREFIX = "action-failed:";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
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
// What the last channel build made, so a ring posts on the channel that exists.
let liveAlarmChannel = ALARM_CHANNEL;

/**
 * Both channels, created once. The promise is kept so two rings in one
 * turn do not race the settings calls. The first vault read calls this,
 * so the 1.3.0 channels go without waiting for an alert.
 */
export function ensureChannels(): Promise<void> {
  channels ??= createChannels().catch((error: unknown) => {
    channels = null;
    throw error;
  });
  return channels;
}

/**
 * Create the channels again. Android drops a channel's Do Not Disturb
 * bypass when the app lacks access as it makes the channel, and keeps
 * it when a later call asks again with access. Settings sends the
 * operator to grant that access, so the app asks on every foreground.
 */
export function refreshChannels(): Promise<void> {
  channels = null;
  return ensureChannels();
}

async function createCategory(): Promise<void> {
  // Done and Didn't do stay in the background: a press from a killed app
  // runs the background task and never opens the app. Snooze opens the
  // app, on the sheet that holds its choices. A tap on the notification
  // itself still opens the task.
  const background = { opensAppToForeground: false };
  const done = {
    identifier: DONE_BUTTON,
    buttonTitle: "Done",
    options: background,
  };
  const didnt = {
    identifier: DROP_BUTTON,
    buttonTitle: "Didn't do",
    options: background,
  };
  const snooze = {
    identifier: SNOOZE_BUTTON,
    buttonTitle: "Snooze",
    options: { opensAppToForeground: true },
  };
  await Notifications.setNotificationCategoryAsync(CATEGORIES.full, [
    done,
    snooze,
    didnt,
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORIES.allday, [
    done,
    didnt,
  ]);
}

async function createChannels(): Promise<void> {
  await createCategory();
  const dnd = AlarmAccess.hasDndAccess();
  const alarmChannel = dnd ? ALARM_CHANNEL_WITH_DND : ALARM_CHANNEL;
  liveAlarmChannel = alarmChannel;
  for (const id of [...STALE_CHANNELS, dnd ? ALARM_CHANNEL : ALARM_CHANNEL_WITH_DND]) {
    await Notifications.deleteNotificationChannelAsync(id);
  }
  await Notifications.setNotificationChannelAsync(NORMAL_CHANNEL, {
    name: "Reminders",
    description: "One ring at the reminder's time. Follows Do Not Disturb.",
    importance: AndroidImportance.HIGH,
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync(alarmChannel, {
    name: "Alarms",
    description: "A task set as an alarm: sounds on the alarm stream.",
    importance: AndroidImportance.MAX,
    sound: ALARM_SOUND,
    enableVibrate: true,
    bypassDnd: dnd,
    audioAttributes: {
      usage: AndroidAudioUsage.ALARM,
      contentType: AndroidAudioContentType.SONIFICATION,
    },
  });
  await rearmRings();
}

/**
 * Schedule one ring under its own id. An alarm uses alarm clock
 * delivery, so it fires on time in Doze and shows the alarm icon. A
 * normal reminder is best effort.
 */
export async function scheduleRing(ring: AlertRing): Promise<string> {
  const granted = await ensureNotificationPermission();
  if (!granted) {
    throw new Error("notification permission not granted");
  }
  await ensureChannels();
  await postRing(ring);
  return ring.id;
}

async function postRing(ring: AlertRing): Promise<void> {
  const alarm = ring.weight === "harsh";
  await Notifications.scheduleNotificationAsync({
    identifier: ring.id,
    content: {
      title: ring.title,
      body: ring.body,
      data: {
        uri: ring.uri,
        weight: ring.weight,
        base: ring.base,
        buttons: ring.buttons,
      },
      categoryIdentifier: CATEGORIES[ring.buttons],
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(ring.when),
      channelId: alarm ? liveAlarmChannel : NORMAL_CHANNEL,
      delivery: alarm ? "alarmClock" : "bestEffort",
    },
  });
}

/**
 * An armed ring keeps the channel and the buttons it was posted with.
 * The channel swap deletes the other alarm id, so an alarm still on it
 * goes back into the live channel, or it would fire into a deleted one
 * with no bypass. A ring on a category this build no longer makes would
 * ring with no buttons, so it goes back under the live one. An older
 * build's rings, with no category at all, wait for the next rebuild.
 */
async function rearmRings(): Promise<void> {
  const alarmIds = [ALARM_CHANNEL, ALARM_CHANNEL_WITH_DND];
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of requests) {
    const trigger = request.trigger as { channelId?: string | null } | null;
    const data = ringData(request.content);
    if (data == null) {
      continue;
    }
    const staleChannel =
      data.weight === "harsh" &&
      trigger?.channelId != null &&
      trigger.channelId !== liveAlarmChannel &&
      alarmIds.includes(trigger.channelId);
    const staleButtons = OLDER_CATEGORIES.includes(
      request.content.categoryIdentifier ?? "",
    );
    if (!staleChannel && !staleButtons) {
      continue;
    }
    await postRing({
      id: request.identifier,
      uri: data.uri,
      base: data.base,
      weight: data.weight,
      buttons: data.buttons,
      when: data.base,
      title: request.content.title ?? "",
      body: request.content.body ?? "",
    });
  }
}

function ringData(content: {
  data?: Record<string, unknown>;
}): RingData | null {
  const { uri, base, weight, buttons } = content.data ?? {};
  return typeof uri === "string" &&
    typeof base === "number" &&
    (weight === "harsh" || weight === "quiet")
    ? { uri, base, weight, buttons: buttons === "full" ? "full" : "allday" }
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
 * Ask the phone to allow exact alarms. Without it, Android may ring an
 * alarm minutes late. The call opens the system screen that grants it.
 */
export async function askExactAlarms(): Promise<void> {
  await Notifications.requestExactAlarmPermissionsAsync();
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
    trigger: { channelId: NORMAL_CHANNEL },
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
