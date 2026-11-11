import * as React from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { taskIsDone } from "@monkey-tasks/schemas";
import { parseStoredDate } from "@/utils/dates";
import type { TaskItem } from "@/types/task";
import {
  cancelAllScheduled,
  cancelScheduled,
  ensureNotificationPermission,
  scheduleAt,
} from "@/lib/notifications";
import { TASKS_KEY, type TaskListData } from "./query";

type PendingReminder = { uri: string; when: Date; title: string };

/**
 * Which alarm ids belong to which task note, so a tick can cancel that
 * task's alarms without touching the rest. Rebuilt by `syncReminders`.
 */
const alarmIds = new Map<string, string[]>();

/**
 * Every alarm change waits for the one before it. A rebuild cancels
 * every alarm and then schedules each one, with a native call between
 * each step. Two runs that overlap would both schedule, and one
 * reminder would ring twice.
 */
let chain: Promise<unknown> = Promise.resolve();

function inTurn<T>(work: () => Promise<T>): Promise<T> {
  const next = chain.then(work, work);
  chain = next.catch(() => undefined);
  return next;
}

/** The future reminders on an open task, in order. */
function reminderTimes(task: TaskItem | null): number[] {
  const data = task?.data;
  // A completed task keeps its reminders in the note but rings no
  // alarm; an unreadable note has no reminders to trust either.
  if (data == null || taskIsDone(data)) {
    return [];
  }
  const now = Date.now();
  return (data.reminders ?? [])
    .map((value) => parseStoredDate(value))
    .filter(
      (parsed): parsed is NonNullable<typeof parsed> =>
        parsed != null && parsed.date.getTime() > now,
    )
    .map((parsed) => parsed.date.getTime())
    .sort((a, b) => a - b);
}

function sameTimes(before: number[], after: number[]): boolean {
  return (
    before.length === after.length &&
    before.every((value, index) => value === after[index])
  );
}

/**
 * Rebuild the OS alarm list from the task list: one exact alarm per
 * future reminder on an open task, nothing else. Reminders are absolute
 * datetimes, so the whole list can be recomputed from the notes after
 * every load instead of tracking alarms one by one.
 *
 * Alarms are best effort: the store calls this fire-and-forget, so it
 * reports what it managed and never throws.
 */
export function syncReminders(
  tasks: TaskItem[],
): Promise<{ scheduled: number; skipped: boolean }> {
  return inTurn(() => rebuild(tasks));
}

async function rebuild(
  tasks: TaskItem[],
): Promise<{ scheduled: number; skipped: boolean }> {
  // Web has no notification API; the design preview never asks for one.
  if (Platform.OS === "web") {
    return { scheduled: 0, skipped: true };
  }

  const pending: PendingReminder[] = [];
  for (const task of tasks) {
    for (const ms of reminderTimes(task)) {
      pending.push({ uri: task.uri, when: new Date(ms), title: task.name });
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
    alarmIds.clear();
    for (const reminder of pending) {
      const id = await scheduleAt(reminder.when, reminder.title, "Task reminder");
      const ids = alarmIds.get(reminder.uri) ?? [];
      ids.push(id);
      alarmIds.set(reminder.uri, ids);
      scheduled += 1;
    }
    return { scheduled, skipped: pending.length === 0 };
  } catch {
    return { scheduled, skipped: true };
  }
}

/**
 * Move one task's alarms to match its new state. A tick cancels that
 * task's alarms and schedules its new ones; the rest of the list is
 * untouched, so a tap never rebuilds every alarm in the vault.
 *
 * Same contract as `syncReminders`: best effort, never throws.
 */
export function syncTaskReminders(
  before: TaskItem | null,
  after: TaskItem | null,
): Promise<void> {
  return inTurn(() => moveTaskAlarms(before, after));
}

async function moveTaskAlarms(
  before: TaskItem | null,
  after: TaskItem | null,
): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  const uri = after?.uri ?? before?.uri;
  if (uri == null) {
    return;
  }
  const was = reminderTimes(before);
  const now = reminderTimes(after);
  if (sameTimes(was, now)) {
    return;
  }

  const stale = alarmIds.get(uri) ?? [];
  alarmIds.delete(uri);
  for (const id of stale) {
    try {
      await cancelScheduled(id);
    } catch {
      // An id the OS already dropped needs no second cancel.
    }
  }
  if (after == null || now.length === 0) {
    return;
  }

  try {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      return;
    }
    const ids: string[] = [];
    for (const ms of now) {
      ids.push(await scheduleAt(new Date(ms), after.name, "Task reminder"));
    }
    alarmIds.set(uri, ids);
  } catch {
    // Best effort: a missing channel or permission leaves the task open.
  }
}

/**
 * Rebuild every alarm after each read of the vault, and only then. A
 * read from disk is the one time the store learns about notes another
 * app changed. A tap writes the cache with `setQueryData`, which is a
 * manual update, and its mutation moves that one task's alarms.
 */
export function useReminderSync(): void {
  const client = useQueryClient();
  React.useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.type !== "updated" ||
          event.action.type !== "success" ||
          event.action.manual === true ||
          event.query.queryKey[0] !== TASKS_KEY
        ) {
          return;
        }
        const data = event.query.state.data as TaskListData | undefined;
        if (data != null) {
          void syncReminders(data.tasks);
        }
      }),
    [client],
  );
}
