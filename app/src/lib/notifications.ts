import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";

/**
 * The browser preview has no alarm API. Every call here is a quiet
 * no-op on the web, so a screen that asks for the alarm state there
 * gets an empty answer and the console stays clean.
 */
export const alarmsSupported = Platform.OS !== "web";

if (alarmsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const CHANNEL_ID = "reminders";

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!alarmsSupported) {
    return false;
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) {
    return true;
  }
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

async function ensureChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Task reminders",
    importance: AndroidImportance.MAX,
  });
}

/**
 * Schedule one exact alarm (the path proven in ticket 0001: alarm
 * clock delivery survives reboot when the app is backgrounded).
 */
export async function scheduleAt(
  when: Date,
  title: string,
  body: string,
): Promise<string> {
  if (!alarmsSupported) {
    throw new Error("alarms are not available on the web");
  }
  const granted = await ensureNotificationPermission();
  if (!granted) {
    throw new Error("notification permission not granted");
  }
  await ensureChannel();
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: CHANNEL_ID,
      delivery: "alarmClock",
    },
  });
}

export async function cancelAllScheduled(): Promise<void> {
  if (!alarmsSupported) {
    return;
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function cancelScheduled(id: string): Promise<void> {
  if (!alarmsSupported) {
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function listScheduled(): Promise<
  { id: string; title?: string; when?: number }[]
> {
  if (!alarmsSupported) {
    return [];
  }
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
  if (!alarmsSupported) {
    return false;
  }
  const exact = await Notifications.getExactAlarmPermissionsAsync();
  return exact.granted;
}
