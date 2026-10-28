const pad = (n: number) => String(n).padStart(2, "0");

export function formatLocal(date: Date, withTime: boolean): string {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (!withTime) {
    return datePart;
  }
  return `${datePart}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function todayIso(): string {
  return formatLocal(new Date(), false);
}

/**
 * The current local moment to the second: a new note's `created`.
 * Obsidian's Date & time property uses ISO 8601 at second resolution,
 * local time, so a note opens with the type it expects.
 */
export function nowStamp(): string {
  const now = new Date();
  return `${formatLocal(now, true)}:${pad(now.getSeconds())}`;
}

/** Seconds are schema-legal but the app carries no use for them:
    they are accepted and ignored. */
export function parseStoredDate(value: string): {
  date: Date;
  hasTime: boolean;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2})?)?$/.exec(
    value,
  );
  if (!match) {
    return null;
  }
  const [, y, m, d, hh, mm] = match;
  const hours = hh ? Number(hh) : 0;
  const minutes = mm ? Number(mm) : 0;
  // Shape-valid but impossible clock values cannot linger either.
  if (hh && (hours > 23 || minutes > 59)) {
    return null;
  }
  const date = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    hours,
    minutes,
  );
  // A regex-valid value can still be out of range and silently roll
  // (2026-02-30, 2026-13-01). The app renders such notes as undated,
  // loudly, instead of filing them under the wrong month.
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(m) - 1
  ) {
    return null;
  }
  return { date, hasTime: hh != null };
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Midnight at the start of the local day, in epoch milliseconds. */
export function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** A clock time the way the rows write it: "7:05 PM". */
export function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${h}:${String(date.getMinutes()).padStart(2, "0")} ${ampm}`;
}

/** The local calendar day as YYYY-MM-DD. */
export function isoOf(date: Date): string {
  return formatLocal(date, false);
}

export function addDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function dayLabel(date: Date, today: Date): string {
  const todayStart = startOfDay(today).getTime();
  const diff = Math.round((startOfDay(date).getTime() - todayStart) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

/** Two dates fall on the same calendar day, null-safe. */
export function isSameDay(a: Date | null, b: Date | null): boolean {
  if (a == null || b == null) {
    return false;
  }
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
