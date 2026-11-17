/** The heading's words. Parsed from the day string, never from a Date,
    so no timezone can move the day the heading names. */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DayParts = {
  /** "November 2026". */
  month: string;
  /** "Saturday 14". */
  date: string;
};

/** The heading for one `YYYY-MM-DD`. */
export function dayParts(day: string): DayParts {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = new Date(year, month - 1, date).getDay();
  return {
    month: `${MONTHS[month - 1]} ${year}`,
    date: `${WEEKDAYS[weekday]} ${date}`,
  };
}

/** What a screen reader hears for the Food band. */
export function foodName(count: number): string {
  const noun = count === 1 ? "entry" : "entries";
  return count === 0 ? "food today, no entries" : `food today, ${count} ${noun}`;
}

/** A failed send, as the toast reads it. */
export function failureMessage(error: unknown, changed: boolean): string {
  if (changed) {
    return "Your note changed in another app. Retry adds this entry to the new version.";
  }
  const message = error instanceof Error ? error.message : String(error);
  return `Couldn't save the entry. ${message}`;
}
