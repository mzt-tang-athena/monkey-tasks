import { Platform } from "react-native";
import { taskIsDone } from "@monkey-tasks/schemas";
import { parseStoredDate } from "../../lib/dates";
import type { TaskItem } from "../tasks/query";
import {
  cancelAllScheduled,
  ensureNotificationPermission,
  scheduleAt,
} from "./schedule";

type PendingReminder = { when: Date; title: string };

/**
 * Rebuild the OS alarm list from the task list: one exact alarm per
 * future reminder on an open task, nothing else. Reminders are absolute
 * datetimes, so the whole list can be recomputed from the notes after
 * every load instead of tracking alarms one by one.
 *
 * Alarms are best effort: the store calls this fire-and-forget, so it
 * reports what it managed and never throws.
 */
export async function syncReminders(
  tasks: TaskItem[],
): Promise<{ scheduled: number; skipped: boolean }> {
  // Web has no notification API; the design preview never asks for one.
  if (Platform.OS === "web") {
    return { scheduled: 0, skipped: true };
  }

  const now = Date.now();
  const pending: PendingReminder[] = [];
  for (const task of tasks) {
    const data = task.data;
    // A completed task keeps its reminders in the note but rings no
    // alarm; an unreadable note has no reminders to trust either.
    if (data == null || taskIsDone(data)) {
      continue;
    }
    for (const value of data.reminders ?? []) {
      const parsed = parseStoredDate(value);
      if (parsed == null || parsed.date.getTime() <= now) {
        continue;
      }
      pending.push({ when: parsed.date, title: task.name });
    }
  }

  // This runs only after a successful vault read, so the notes are the
  // truth: a task completed or deleted since the last sync drops its
  // alarm here instead of ringing from stale state. Permission is
  // checked before the cancel, so a denied prompt cannot wipe alarms.
  let scheduled = 0;
  try {
    if (pending.length > 0) {
      // One prompt covers the whole batch; scheduleAt reuses the granted
      // state for each alarm it creates.
      const granted = await ensureNotificationPermission();
      if (!granted) {
        return { scheduled: 0, skipped: true };
      }
    }
    await cancelAllScheduled();
    for (const reminder of pending) {
      await scheduleAt(reminder.when, reminder.title, "Task reminder");
      scheduled += 1;
    }
    return { scheduled, skipped: pending.length === 0 };
  } catch {
    return { scheduled, skipped: true };
  }
}
