/**
 * The sample set the suite runs against, and where each task lands
 * under TODAY. The preview builds the set in `src/lib/mock.ts`, with
 * dates relative to the current day. Specs take names and dates from
 * this file only, so a change to the sample set changes one file.
 */

/** Monday 26 October 2026, 09:00 in Auckland (NZDT). */
export const TODAY = new Date("2026-10-26T09:00:00+13:00");

/** The list tabs. Main is first, and the list notes follow by name. */
export const tabs = {
  main: "Main",
  /** The tab after Main. No sample task sits on it. */
  next: "Errands",
} as const;

/** The section headers on Main under TODAY. */
export const sections = {
  today: "Today",
  undated: "No date",
  completed: "Completed",
} as const;

/** Tasks with no date. In My order they sort by name, so the first
    two are `first` then `second`. */
export const undated = {
  first: "Book train tickets home",
  second: "Call Mum",
} as const;

/** A task due today, at 7:00 PM, that repeats daily. */
export const supplements = "Supplements";

/** A task note that fails validation. It never renders as a row. */
export const broken = "Broken note";

/** An overdue task with no time: due yesterday. */
export const overdue = {
  name: "Return library books",
  /** The timeline hour it is dropped on, and the time it then shows. */
  dropHour: 10,
  dropTime: "10:00 AM",
} as const;

/** The day after TODAY, as the day heading writes it, and the timed
    task it holds. */
export const tomorrow = {
  heading: "Tuesday 27",
  task: "Dentist appointment",
  hour: 14,
  time: "2:30 PM",
} as const;

/** The month titles either side of a month swipe. */
export const months = {
  current: "October 2026",
  next: "November 2026",
} as const;

/** A capture with a date phrase, and where it lands. */
export const capture = {
  typed: "Buy stamps for card friday 5pm",
  name: "Buy stamps for card",
  chipDay: "Fri 30",
  chipTime: "5:00 PM",
  section: "Fri, 30 Oct",
  /** The section after it on Main. */
  nextSection: "No date",
} as const;

/** The editor rename. */
export const rename = {
  from: "Call Mum",
  to: "Call Mum about Sunday",
} as const;
