import { formatLocal } from "@/utils/dates";

/**
 * The Reschedule buttons on a reminder. Each moves the task to the
 * moment its `target` returns, a stored datetime. Android shows at most
 * three buttons on a notification, and Done takes one.
 */
export type RescheduleChoice = {
  /** The button's identifier. */
  id: string;
  title: string;
  target(now: Date): string;
};

const FIVE_MINUTES = 5 * 60_000;
const HOUR = 60 * 60_000;

/** Now plus an hour, rounded up to the next five minutes. */
export function laterTarget(now: Date): string {
  const at = new Date(
    Math.ceil((now.getTime() + HOUR) / FIVE_MINUTES) * FIVE_MINUTES,
  );
  return formatLocal(at, true);
}

/** Tomorrow morning at nine, in the phone's own zone. */
export function tomorrowTarget(now: Date): string {
  const at = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    9,
    0,
    0,
  );
  return formatLocal(at, true);
}

export const RESCHEDULE_CHOICES: readonly RescheduleChoice[] = [
  { id: "later", title: "Later", target: laterTarget },
  { id: "tomorrow", title: "Tomorrow", target: tomorrowTarget },
];

/**
 * The buttons a reminder carries. A task due on a day, with no time of
 * day, is an all-day task: rescheduling it would give it a clock time
 * it never had, so it offers Done alone. A reminder of an all-day task
 * can still ring, because a reminder is always a moment.
 */
export type ButtonSet = "full" | "done";
