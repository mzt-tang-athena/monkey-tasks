import { RRule } from "rrule";
import { formatLocal, parseStoredDate } from "../../lib/dates";

/**
 * rrule iterates floating wall-clock values: it reads and returns dates
 * through their UTC fields. The app stores and renders local wall-clock
 * values, so both directions convert explicitly instead of leaving the
 * result at the mercy of the device timezone.
 */
function toFloating(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
    ),
  );
}

function fromFloating(date: Date): Date {
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );
}

/**
 * The next due date for a stored recurrence rule, or null when the rule
 * is unusable or has no future occurrence.
 *
 * Recurrence is stored bare ("FREQ=DAILY", no "RRULE:" prefix). The
 * stored due date is the rule's DTSTART, so a weekly BYDAY rule keeps
 * the week the user meant; with no usable due date, now anchors it.
 * The answer is the first occurrence strictly after max(due, now):
 * ticking a task that is due today must move it on, and a stale due
 * date must never hand the past back.
 */
export function nextDue(
  recurrence: string,
  due: string | null | undefined,
  now: Date,
): string | null {
  if (recurrence.trim() === "") {
    return null;
  }
  const stored = due ? parseStoredDate(due) : null;
  const hasTime = stored?.hasTime ?? false;
  const start = stored?.date ?? now;
  let next: Date | null = null;
  try {
    const rule = new RRule({
      ...RRule.parseString(recurrence),
      dtstart: toFloating(start),
    });
    const cursor = toFloating(
      new Date(Math.max(start.getTime(), now.getTime())),
    );
    next = rule.after(cursor, false);
  } catch {
    // Unknown keywords, bad frequencies and impossible BYDAY values all
    // surface as throws; an unusable rule is simply not recurring.
    return null;
  }
  return next ? formatLocal(fromFloating(next), hasTime) : null;
}
