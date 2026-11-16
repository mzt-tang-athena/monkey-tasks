import {
  addDays,
  dayLabel,
  formatLocal,
  formatTime,
  parseStoredDate,
  startOfDay,
} from "@/utils/dates";

/** A clock time the pickers offer: a quarter hour of a day. */
export type Clock = { hour: number; minute: number };

/** A stored date or datetime in words: "Tomorrow 9:00 AM", "Mon, 2 Nov". */
export function whenWords(stored: string, today: Date): string {
  const parsed = parseStoredDate(stored);
  if (parsed == null) {
    return "Unreadable date";
  }
  const day = dayLabel(parsed.date, today);
  const year =
    parsed.date.getFullYear() === today.getFullYear()
      ? ""
      : ` ${parsed.date.getFullYear()}`;
  return parsed.hasTime
    ? `${day}${year} ${formatTime(parsed.date)}`
    : `${day}${year}`;
}

/** The time a stored value carries, or null for a plain date. */
export function clockOf(stored: string | null): Clock | null {
  const parsed = stored == null ? null : parseStoredDate(stored);
  if (parsed == null || !parsed.hasTime) {
    return null;
  }
  return { hour: parsed.date.getHours(), minute: parsed.date.getMinutes() };
}

/** The day a stored value falls on, or null. */
export function dayOf(stored: string | null): Date | null {
  const parsed = stored == null ? null : parseStoredDate(stored);
  return parsed == null ? null : startOfDay(parsed.date);
}

/** The stored form of a day, with a time when one is given. */
export function storedOf(day: Date, clock: Clock | null): string {
  if (clock == null) {
    return formatLocal(day, false);
  }
  const at = startOfDay(day);
  at.setHours(clock.hour, clock.minute);
  return formatLocal(at, true);
}

/** The Due picker's quick days. Next week is the coming Monday. */
export function quickDays(today: Date): { label: string; day: Date }[] {
  const start = startOfDay(today);
  const toMonday = ((8 - start.getDay()) % 7) || 7;
  return [
    { label: "Today", day: start },
    { label: "Tomorrow", day: addDays(start, 1) },
    { label: "Next week", day: addDays(start, toMonday) },
  ];
}

/**
 * One month as calendar rows, Sunday first as on the planner. A cell is
 * a day of the month, or null before the first and after the last.
 */
export function monthRows(month: Date): (Date | null)[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const rows: (Date | null)[][] = [];
  for (let at = 0; at < cells.length; at += 7) {
    rows.push(cells.slice(at, at + 7));
  }
  return rows;
}

/** The hour on a twelve hour face, 1 to 12. */
export function faceHour(hour: number): number {
  return hour % 12 || 12;
}

/** A face hour and a half of the day, back to 0 to 23. */
export function dayHour(face: number, pm: boolean): number {
  return (face % 12) + (pm ? 12 : 0);
}
