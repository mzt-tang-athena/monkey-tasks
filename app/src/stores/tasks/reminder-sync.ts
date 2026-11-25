import * as React from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { taskIsDone, type AlertWeight } from "@monkey-tasks/schemas";
import { parseStoredDate } from "@/utils/dates";
import type { TaskItem } from "@/types/task";
import {
  ESCALATION_MINUTES,
  alertRing,
  type AlertRing,
} from "@/lib/alerts/rings";
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
  scheduleRing,
  type RingNotification,
} from "@/lib/notifications";
import { TASKS_KEY, type TaskListData } from "./query";

/** A moment the OS should ring, and whether it is the task's due time. */
type AlarmTime = { when: number; due: boolean };

/** What a rebuild must schedule and cancel to reach the wanted rings. */
export type AlertPlan = { schedule: AlertRing[]; cancel: string[] };

const MINUTE_MS = 60_000;

/** The whole harsh escalation fits in this window; quiet is shorter. */
const LOOKBACK_MS =
  Math.max(...ESCALATION_MINUTES.harsh) * MINUTE_MS;

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
  return task.data?.["alert weight"] ?? "harsh";
}

/** Every ring the task makes that is still ahead of `now`. */
function ringsFor(task: TaskItem | null, now: number): AlertRing[] {
  if (task == null) {
    return [];
  }
  const weight = taskWeight(task);
  const rings: AlertRing[] = [];
  // The window reaches back the whole escalation, so a started group
  // still yields the follow-ups that are ahead.
  for (const alarm of alarmTimes(task, now - LOOKBACK_MS)) {
    for (const step of ESCALATION_MINUTES[weight]) {
      rings.push(
        alertRing({
          uri: task.uri,
          base: alarm.when,
          step,
          weight,
          title: task.name,
          body: alarmBody(alarm),
        }),
      );
    }
  }
  return rings.filter((ring) => ring.when > now);
}

function sameRings(before: AlertRing[], after: AlertRing[]): boolean {
  return (
    before.length === after.length &&
    before.every(
      (ring, index) =>
        ring.id === after[index].id && ring.weight === after[index].weight,
    )
  );
}

/**
 * The rings the OS should hold right now, and the scheduled ones it
 * must drop. Pure: `now`, the acknowledged groups and the OS schedule
 * are its whole input.
 *
 * A scheduled ring stays only while its task is open, its group is
 * unacknowledged, its weight still matches the note, and its base
 * minute is still one of the note's alarms over the escalation window.
 * A ring whose base is ahead also leaves when its exact step is not
 * wanted. A cancelled ring that is still wanted comes back under the
 * new weight or step.
 */
export function planRings(
  tasks: readonly TaskItem[],
  now: number,
  acked: AckedGroups,
  scheduled: readonly RingNotification[],
): AlertPlan {
  const byUri = new Map(tasks.map((task) => [task.uri, task]));
  const wanted = new Map<string, AlertRing>();
  const weights = new Map<string, AlertWeight>();
  const bases = new Map<string, Set<number>>();
  for (const task of tasks) {
    weights.set(task.uri, taskWeight(task));
    bases.set(
      task.uri,
      new Set(
        alarmTimes(task, now - LOOKBACK_MS).map((alarm) => alarm.when),
      ),
    );
    for (const ring of ringsFor(task, now)) {
      if (!isAcked(acked, ring.uri, ring.base)) {
        wanted.set(ring.id, ring);
      }
    }
  }

  const cancel: string[] = [];
  for (const entry of scheduled) {
    const data = entry.data;
    // A notification this build did not schedule is not a ring.
    if (data == null) {
      continue;
    }
    const task = byUri.get(data.uri);
    if (task == null || task.data == null || taskIsDone(task.data)) {
      cancel.push(entry.id);
      continue;
    }
    if (isAcked(acked, data.uri, data.base)) {
      cancel.push(entry.id);
      continue;
    }
    const weight = weights.get(data.uri);
    // A ring scheduled before the buttons existed has none. Its id
    // stays, so the new one replaces it.
    if (
      !data.buttons ||
      data.weight !== weight ||
      !bases.get(data.uri)?.has(data.base)
    ) {
      cancel.push(entry.id);
      continue;
    }
    if (data.base > now && wanted.get(entry.id) == null) {
      cancel.push(entry.id);
    }
  }

  const cancelled = new Set(cancel);
  const scheduledIds = new Set(scheduled.map((entry) => entry.id));
  const schedule = [...wanted.values()]
    .filter((ring) => !scheduledIds.has(ring.id) || cancelled.has(ring.id))
    .sort((a, b) => a.when - b.when || a.id.localeCompare(b.id));

  return { schedule, cancel };
}

/**
 * Rebuild the OS alarm list from the task list after each read of the
 * vault. The notes are the truth: rings whose task is gone or done drop,
 * a running group keeps only the follow-ups its note still wants, and a
 * delivered ring is never armed again because its minute has passed.
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
