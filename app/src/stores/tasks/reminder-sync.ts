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

type PendingAlarm = {
  uri: string;
  when: Date;
  title: string;
  body: string;
};

/** A moment the OS should ring, and whether it is the task's due time. */
type AlarmTime = { when: number; due: boolean };

const MINUTE_MS = 60_000;

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

/**
 * The alarms an open task should ring, in order: its timed due, then
 * each reminder as an extra alert. A reminder in the due minute adds no
 * second ring. A date-only due has no time of day, so it stays silent.
 */
function alarmTimes(task: TaskItem | null): AlarmTime[] {
  const data = task?.data;
  // A completed task keeps its due and reminders in the note but rings
  // no alarm; an unreadable note has nothing to trust either.
  if (data == null || taskIsDone(data)) {
    return [];
  }
  const now = Date.now();
  const alarms: AlarmTime[] = [];
  const due = data.due == null ? null : parseStoredDate(data.due);
  if (due != null && due.hasTime && due.date.getTime() > now) {
    alarms.push({ when: due.date.getTime(), due: true });
  }
  for (const value of data.reminders ?? []) {
    const parsed = parseStoredDate(value);
    if (parsed != null && parsed.date.getTime() > now) {
      alarms.push({ when: parsed.date.getTime(), due: false });
    }
  }
  // Time order, and the due wins a shared minute.
  alarms.sort((a, b) => a.when - b.when || Number(b.due) - Number(a.due));
  const minutes = new Set<number>();
  return alarms.filter((alarm) => {
    const minute = Math.floor(alarm.when / MINUTE_MS);
    if (minutes.has(minute)) {
      return false;
    }
    minutes.add(minute);
    return true;
  });
}

/** A due alarm says it is due; a reminder keeps its own wording. */
function alarmBody(alarm: AlarmTime): string {
  return alarm.due ? "Due" : "Task reminder";
}

function sameAlarms(before: AlarmTime[], after: AlarmTime[]): boolean {
  return (
    before.length === after.length &&
    before.every(
      (alarm, index) =>
        alarm.when === after[index].when && alarm.due === after[index].due,
    )
  );
}

/**
 * Rebuild the OS alarm list from the task list: one exact alarm per
 * future alarm on an open task (a timed due, and each reminder), nothing
 * else. All of them are absolute datetimes, so the whole list can be
 * recomputed from the notes after every load instead of tracking alarms
 * one by one.
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

  const pending: PendingAlarm[] = [];
  for (const task of tasks) {
    for (const alarm of alarmTimes(task)) {
      pending.push({
        uri: task.uri,
        when: new Date(alarm.when),
        title: task.name,
        body: alarmBody(alarm),
      });
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
    for (const alarm of pending) {
      const id = await scheduleAt(alarm.when, alarm.title, alarm.body);
      const ids = alarmIds.get(alarm.uri) ?? [];
      ids.push(id);
      alarmIds.set(alarm.uri, ids);
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
  const was = alarmTimes(before);
  const now = alarmTimes(after);
  if (sameAlarms(was, now)) {
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
    for (const alarm of now) {
      ids.push(
        await scheduleAt(new Date(alarm.when), after.name, alarmBody(alarm)),
      );
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
