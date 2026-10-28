import { formatTime, parseStoredDate } from "@/utils/dates";
import type { CaptureTarget } from "@/types/task";

/**
 * Labels for the parse chips: one short word or figure per chip, so
 * the row reads at a glance. Pure, so the component stays a thin
 * renderer over the parse result.
 */

export function targetLabel(target: CaptureTarget): string {
  return target.kind === "main" ? "Main" : target.name;
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dueChipLabel(due: string): string {
  const parsedDue = parseStoredDate(due);
  if (!parsedDue) {
    return "";
  }
  return `${WEEKDAYS_SHORT[parsedDue.date.getDay()]} ${parsedDue.date.getDate()}`;
}

export function timeChipLabel(due: string): string {
  const parsedDue = parseStoredDate(due);
  if (!parsedDue) {
    return "";
  }
  return formatTime(parsedDue.date);
}

export function recurrenceKeyword(rule: string): string {
  const match = /FREQ=([A-Z]+)/.exec(rule);
  return match ? match[1].toLowerCase() : "";
}
