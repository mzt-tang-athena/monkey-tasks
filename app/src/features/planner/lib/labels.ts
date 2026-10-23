import type { TaskItem } from "../../tasks/query";
import { parseStoredDate } from "../../../lib/dates";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const WEEKDAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const MONTHS = [
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
];

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function labelHour(hour: number): string {
  const h = hour % 12 || 12;
  return `${h} ${hour >= 12 ? "PM" : "AM"}`;
}

/** The short date chip a placed pill carries; empty when undated. */
export function pillDateLabel(task: TaskItem): string {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  if (!due) {
    return "";
  }
  return `${MONTHS_SHORT[due.date.getMonth()]} ${due.date.getDate()}`;
}
