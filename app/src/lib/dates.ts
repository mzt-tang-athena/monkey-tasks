const pad = (n: number) => String(n).padStart(2, "0");

export function formatLocal(date: Date, withTime: boolean): string {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (!withTime) {
    return datePart;
  }
  return `${datePart}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatToday(): string {
  return todayIso();
}

export function todayIso(): string {
  return formatLocal(new Date(), false);
}

/** Parse a stored date or datetime value. */
export function parseStoredDate(value: string): {
  date: Date;
  hasTime: boolean;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) {
    return null;
  }
  const [, y, m, d, hh, mm] = match;
  const date = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    hh ? Number(hh) : 0,
    mm ? Number(mm) : 0,
  );
  return { date, hasTime: hh != null };
}

/** 24-hour clock time, "19:00". Rendered in the mono signature font. */
export function formatTime24(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
