import { RRule } from "rrule";
import { taskIsDone } from "@monkey-tasks/schemas";
import { addDays, formatLocal, parseStoredDate, startOfDay } from "@/utils/dates";
import type { TaskItem } from "@/types/task";

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

/** The rule text of a monthly rule that lands on the month's end. */
function monthlyForm(interval: number, day: number): string {
  const head =
    interval === 1 ? "FREQ=MONTHLY" : `FREQ=MONTHLY;INTERVAL=${interval}`;
  if (day <= 28) {
    return head;
  }
  if (day === 31) {
    return `${head};BYMONTHDAY=-1`;
  }
  const days = day === 30 ? "28,29,30" : "28,29";
  return `${head};BYMONTHDAY=${days};BYSETPOS=-1`;
}

/** The same for a yearly rule. Only 29 February needs the change. */
function yearlyForm(interval: number, leapDay: boolean): string {
  const head =
    interval === 1 ? "FREQ=YEARLY" : `FREQ=YEARLY;INTERVAL=${interval}`;
  return leapDay ? `${head};BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1` : head;
}

/**
 * The rule that gives a month-end task a due date in every month
 * (ADR 0042, ticket 0066). A bare monthly rule on a due day after the
 * 28th, and a bare yearly rule on 29 February, become a rule that
 * lands on the last day of a short month and goes back to its own day
 * after it. The rule carries the day, so it does not depend on the
 * start date. Any other rule comes back unchanged.
 *
 * A rule this function made stays as it is while the due day follows
 * the rule: the occurrence after 31 January is 28 February, and its
 * rule must still say "last day". `reanchor` is for a due day the user
 * changed. It also replaces a rule this function made, so the rule
 * follows the new day.
 */
export function monthEndRule(
  recurrence: string,
  due: string,
  reanchor = false,
): string {
  const stored = parseStoredDate(due);
  if (stored == null) {
    return recurrence;
  }
  const day = stored.date.getDate();
  const text = recurrence.trim().replace(/;INTERVAL=1(?=;|$)/, "");
  const monthly = /^FREQ=MONTHLY(?:;INTERVAL=(\d+))?/.exec(text);
  if (monthly != null) {
    const interval = Number(monthly[1] ?? 1);
    const forms = [28, 29, 30, 31].map((d) => monthlyForm(interval, d));
    if (interval >= 1 && forms.includes(text)) {
      const bare = text === forms[0];
      return bare || reanchor ? monthlyForm(interval, day) : recurrence;
    }
    return recurrence;
  }
  const yearly = /^FREQ=YEARLY(?:;INTERVAL=(\d+))?/.exec(text);
  if (yearly != null) {
    const interval = Number(yearly[1] ?? 1);
    const leapDay = stored.date.getMonth() === 1 && day === 29;
    const bare = yearlyForm(interval, false);
    const made = yearlyForm(interval, true);
    if (interval >= 1 && (text === bare || (reanchor && text === made))) {
      return yearlyForm(interval, leapDay);
    }
  }
  return recurrence;
}

/** A rule anchored at start, or null when the rule is unusable.
    Unknown keywords, bad frequencies and impossible BYDAY values all
    surface as throws; an unusable rule is simply not recurring. */
function buildRule(recurrence: string, start: Date): RRule | null {
  try {
    return new RRule({
      ...RRule.parseString(recurrence),
      dtstart: toFloating(start),
    });
  } catch {
    return null;
  }
}

/**
 * Parsed rules by recurrence plus stored due. The due date is the
 * rule's DTSTART, so both belong in the key. A month render asks about
 * the same task once per cell, and this keeps it to one parse per
 * rule. FIFO eviction: a long-lived session with many edited rules
 * must not grow the map forever.
 */
const RULE_CACHE_LIMIT = 256;
const ruleCache = new Map<string, RRule | null>();

function ruleFor(recurrence: string, due: string): RRule | null {
  const key = `${recurrence}\u0000${due}`;
  const cached = ruleCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const stored = parseStoredDate(due);
  // A bare monthly rule on a late due day reads as a month-end rule, so
  // an old note gets every month (ADR 0042).
  const rule =
    stored == null
      ? null
      : buildRule(monthEndRule(recurrence, due), stored.date);
  if (ruleCache.size >= RULE_CACHE_LIMIT) {
    const oldest = ruleCache.keys().next();
    if (!oldest.done) {
      ruleCache.delete(oldest.value);
    }
  }
  ruleCache.set(key, rule);
  return rule;
}

/**
 * The occurrence after a stored due date, with no clamp to today. This
 * is the date a completed occurrence hands to its successor. It can be
 * in the past, because a task finished late still follows the schedule;
 * the successor then shows immediately.
 */
export function nextAfter(
  recurrence: string,
  due: string | null | undefined,
): string | null {
  if (recurrence.trim() === "" || due == null) {
    return null;
  }
  const stored = parseStoredDate(due);
  const rule = stored == null ? null : ruleFor(recurrence, due);
  if (stored == null || rule == null) {
    return null;
  }
  let next: Date | null = null;
  try {
    next = rule.after(toFloating(stored.date), false);
  } catch {
    return null;
  }
  return next ? formatLocal(fromFloating(next), stored.hasTime) : null;
}

/**
 * Every day in [from, to] that a task touches, as local midnights in
 * ascending order. The range form of occursOn: the month grid buckets
 * a task by these days instead of re-deriving its rule per cell.
 *
 * A stored due day always counts. Rule occurrences count only for an
 * open task, so completing a recurring task never paints occurrences
 * it has already moved past. A task with no usable due touches no day.
 */
export function occurrencesBetween(
  task: TaskItem,
  from: Date,
  to: Date,
): Date[] {
  const data = task.data;
  if (data == null) {
    return [];
  }
  const due = data.due;
  if (due == null || due === "") {
    return [];
  }
  const stored = parseStoredDate(due);
  if (stored == null) {
    return [];
  }
  const first = startOfDay(from).getTime();
  const last = startOfDay(to).getTime();
  if (last < first) {
    return [];
  }
  const seen = new Set<number>();
  const days: Date[] = [];
  const push = (day: Date): void => {
    const time = day.getTime();
    if (!seen.has(time)) {
      seen.add(time);
      days.push(day);
    }
  };
  const dueDay = startOfDay(stored.date);
  if (dueDay.getTime() >= first && dueDay.getTime() <= last) {
    push(dueDay);
  }
  const recurrence = data.recurrence;
  if (
    recurrence != null &&
    recurrence.trim() !== "" &&
    !taskIsDone(data)
  ) {
    const rule = ruleFor(recurrence, due);
    if (rule != null) {
      try {
        // Inclusive both ends, then filtered to whole days: an
        // occurrence at the range's closing midnight belongs to the
        // next day and must not leak in.
        const hits = rule.between(
          toFloating(new Date(first)),
          toFloating(addDays(new Date(last), 1)),
          true,
        );
        for (const hit of hits) {
          const day = startOfDay(fromFloating(hit));
          const time = day.getTime();
          if (time >= first && time <= last) {
            push(day);
          }
        }
      } catch {
        // An unusable rule contributes no occurrences.
      }
    }
  }
  days.sort((a, b) => a.getTime() - b.getTime());
  return days;
}

/**
 * Whether a task touches a day. Its stored due falls there, or, for an
 * open task, its rule has an occurrence there. A task with no usable
 * due touches no day, and a done task keeps only its stored due day.
 */
export function occursOn(task: TaskItem, day: Date): boolean {
  return occurrencesBetween(task, day, day).length > 0;
}
