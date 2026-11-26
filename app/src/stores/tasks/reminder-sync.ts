import * as React from "react";
import { AppState, Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { taskIsDone, type AlertWeight } from "@monkey-tasks/schemas";
import { parseStoredDate } from "@/utils/dates";
import type { TaskItem } from "@/types/task";
import { alertRing, type AlertRing } from "@/lib/alerts/rings";
import type { ButtonSet } from "@/lib/alerts/choices";
import {
  isAcked,
  loadAcked,
  recordAcks,
  type AckedGroups,
} from "@/lib/alerts/acked";
import {
  cancelScheduled,
  dismissDelivered,
  ensureChannels,
  ensureNotificationPermission,
  listDeliveredDetailed,
  listScheduledDetailed,
  refreshChannels,
  scheduleRing,
  type RingNotification,
} from "@/lib/notifications";
import { TASKS_KEY, type TaskListData } from "./query";

/** A moment the OS should ring, and whether it is the task's due time. */
type AlarmTime = { when: number; due: boolean };

/** What a rebuild must schedule and cancel to reach the wanted rings. */
export type AlertPlan = { schedule: AlertRing[]; cancel: string[] };

const MINUTE_MS = 60_000;

/**
 * Every alarm change waits for the one before it. A rebuild compares
 * the OS schedule with the wanted rings, with native calls between each
 * step. Two runs that overlap would both see the same gaps and both
 * schedule them.
 */
let chain: Promise<unknown> = Promise.resolve();

export function inTurn<T>(work: () => Promise<T>): Promise<T> {
  const next = chain.then(work, work);
  chain = next.catch(() => undefined);
  return next;
}

/**
 * The alarms an open task should ring, in order: its timed due, then
 * each reminder as an extra alert. A reminder in the due minute adds no
 * second ring. A date-only due has no time of day, so it stays silent.
 */
function alarmTimes(task: TaskItem | null, now: number): AlarmTime[] {
  const data = task?.data;
  // A completed task keeps its due and reminders in the note but rings
  // no alarm; an unreadable note has nothing to trust either.
  if (data == null || taskIsDone(data)) {
    return [];
  }
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

function taskWeight(task: TaskItem): AlertWeight {
  return task.data?.["alert weight"] ?? "quiet";
}

/**
 * The buttons a task's rings carry. A due date with no time of day is
 * an all-day task, and rescheduling it would add a clock time it never
 * had, so it offers Done alone.
 */
function taskButtons(task: TaskItem): ButtonSet {
  const due = task.data?.due;
  if (due == null) {
    return "full";
  }
  const parsed = parseStoredDate(due);
  return parsed != null && !parsed.hasTime ? "done" : "full";
}

/** Every ring the task makes that is still ahead of `now`. */
function ringsFor(task: TaskItem | null, now: number): AlertRing[] {
  if (task == null) {
    return [];
  }
  const weight = taskWeight(task);
  const buttons = taskButtons(task);
  return alarmTimes(task, now).map((alarm) =>
    alertRing({
      uri: task.uri,
      base: alarm.when,
      weight,
      buttons,
      title: task.name,
      body: alarmBody(alarm),
    }),
  );
}

function sameRings(before: AlertRing[], after: AlertRing[]): boolean {
  return (
    before.length === after.length &&
    before.every(
      (ring, index) =>
        ring.id === after[index].id &&
        ring.weight === after[index].weight &&
        ring.buttons === after[index].buttons,
    )
  );
}

/**
 * The rings the OS should hold right now, and the scheduled ones it
 * must drop. Pure: `now`, the acknowledged groups and the OS schedule
 * are its whole input.
 *
 * A scheduled ring stays only while its id is still wanted with the
 * same weight and buttons. A ring from an older build has an id the
 * wanted rings never match, so it goes. A cancelled ring that is still
 * wanted comes back with its new weight or buttons.
 */
export function planRings(
  tasks: readonly TaskItem[],
  now: number,
  acked: AckedGroups,
  scheduled: readonly RingNotification[],
): AlertPlan {
  const wanted = new Map<string, AlertRing>();
  for (const task of tasks) {
    for (const ring of ringsFor(task, now)) {
      if (!isAcked(acked, ring.uri, ring.base)) {
        wanted.set(ring.id, ring);
      }
    }
  }

  const cancel: string[] = [];
  const kept = new Set<string>();
  for (const entry of scheduled) {
    const data = entry.data;
    // A notification this build did not schedule is not a ring.
    if (data == null) {
      continue;
    }
    const ring = wanted.get(entry.id);
    if (
      ring != null &&
      ring.weight === data.weight &&
      ring.buttons === data.buttons
    ) {
      kept.add(entry.id);
    } else {
      cancel.push(entry.id);
    }
  }

  const schedule = [...wanted.values()]
    .filter((ring) => !kept.has(ring.id))
    .sort((a, b) => a.when - b.when || a.id.localeCompare(b.id));

  return { schedule, cancel };
}

/**
 * Rebuild the OS alarm list from the task list after each read of the
 * vault. The notes are the truth: rings whose task is gone or done drop,
 * and a delivered ring is never armed again because its minute has passed.
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

  try {
    await ensureChannels();
    const now = Date.now();
    const scheduled = await listScheduledDetailed();
    const plan = planRings(tasks, now, loadAcked(now), scheduled);
    // Permission is checked before any cancel, so a denied prompt cannot
    // wipe the schedule.
    if (plan.schedule.length > 0) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        return { scheduled: 0, skipped: true };
      }
    }
    for (const id of plan.cancel) {
      await cancelScheduled(id);
    }
    for (const ring of plan.schedule) {
      await scheduleRing(ring);
    }
    return {
      scheduled: plan.schedule.length,
      skipped: plan.schedule.length === 0,
    };
  } catch {
    return { scheduled: 0, skipped: true };
  }
}

/** Every ring a task ever had, including ones whose minute has passed. */
function everyRing(task: TaskItem | null): AlertRing[] {
  return ringsFor(task, Number.NEGATIVE_INFINITY);
}

/**
 * Clear every ring of one task: remember each group as acknowledged, so
 * a later rebuild cannot ring it, then cancel what is scheduled and
 * dismiss what the tray shows.
 */
async function acknowledgeTaskNow(
  uri: string,
  now: number,
  extra: readonly AlertRing[] = [],
): Promise<void> {
  const scheduled = (await listScheduledDetailed()).filter(
    (entry) => entry.data?.uri === uri,
  );
  const delivered = (await listDeliveredDetailed()).filter(
    (entry) => entry.data?.uri === uri,
  );
  const bases = new Set(extra.map((ring) => ring.base));
  for (const entry of [...scheduled, ...delivered]) {
    if (entry.data != null) {
      bases.add(entry.data.base);
    }
  }
  recordAcks(
    [...bases].map((base) => ({ uri, base })),
    now,
  );
  for (const entry of scheduled) {
    await cancelScheduled(entry.id);
  }
  await dismissDelivered(delivered.map((entry) => entry.id));
}

/** Clear one alarm group. Throws when the OS refuses; callers decide. */
export async function acknowledgeRingNow(
  ring: Pick<AlertRing, "uri" | "base">,
): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  const now = Date.now();
  const group = (entry: RingNotification) =>
    entry.data?.uri === ring.uri && entry.data.base === ring.base;
  const scheduled = (await listScheduledDetailed()).filter(group);
  const delivered = (await listDeliveredDetailed()).filter(group);
  recordAcks([{ uri: ring.uri, base: ring.base }], now);
  for (const entry of scheduled) {
    await cancelScheduled(entry.id);
  }
  await dismissDelivered(delivered.map((entry) => entry.id));
}

export function acknowledgeRing(
  ring: Pick<AlertRing, "uri" | "base">,
): Promise<void> {
  return inTurn(async () => {
    try {
      await acknowledgeRingNow(ring);
    } catch {
      // The alert stays; the next rebuild or tap tries again.
    }
  });
}

export function acknowledgeTask(uri: string): Promise<void> {
  return inTurn(async () => {
    if (Platform.OS === "web") {
      return;
    }
    try {
      await acknowledgeTaskNow(uri, Date.now());
    } catch {
      // The alert stays; the next rebuild or tap tries again.
    }
  });
}

/**
 * Move one task's alarms to match its new state. A tick clears that
 * task's rings; an edit reconciles them against the OS schedule. The
 * rest of the list stays untouched, so a tap never rebuilds every alarm
 * in the vault.
 *
 * Same contract as `syncReminders`: best effort, never throws.
 */
export function syncTaskReminders(
  before: TaskItem | null,
  after: TaskItem | null,
): Promise<void> {
  return inTurn(() => reconcileTask(before, after));
}

/** `syncTaskReminders` for a caller that already holds the turn. */
export async function reconcileTask(
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
  const now = Date.now();

  // A tick, a deleted note, or one that no longer parses: nothing of
  // this task stays in the tray or the schedule.
  if (after == null || after.data == null || taskIsDone(after.data)) {
    try {
      await acknowledgeTaskNow(uri, now, everyRing(before));
    } catch {
      // Best effort; the next rebuild clears what this missed.
    }
    return;
  }

  if (sameRings(ringsFor(before, now), ringsFor(after, now))) {
    return;
  }

  try {
    const scheduled = (await listScheduledDetailed()).filter(
      (entry) => entry.data?.uri === uri,
    );
    const plan = planRings([after], now, loadAcked(now), scheduled);
    if (plan.schedule.length > 0) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        return;
      }
    }
    for (const id of plan.cancel) {
      await cancelScheduled(id);
    }
    for (const ring of plan.schedule) {
      await scheduleRing(ring);
    }
  } catch {
    // Best effort: a missing channel or permission leaves the task open.
  }
}

/**
 * Rebuild every alarm after each read of the vault, and only then. A
 * read from disk is the one time the store learns about notes another
 * app changed. A tap writes the cache with `setQueryData`, which is a
 * manual update, and its mutation moves that one task's alarms.
 *
 * Each foreground asks for the channels again, so a Do Not Disturb
 * grant the operator gave in Settings reaches the alarm channel.
 */
export function useReminderSync(): void {
  const client = useQueryClient();
  React.useEffect(() => {
    if (Platform.OS === "web") {
      return undefined;
    }
    const ask = (state: string) => {
      if (state === "active") {
        void inTurn(refreshChannels).catch(() => undefined);
      }
    };
    const subscription = AppState.addEventListener("change", ask);
    return () => subscription.remove();
  }, []);
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
