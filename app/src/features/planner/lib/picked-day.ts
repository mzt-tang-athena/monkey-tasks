import { startOfDay } from "@/utils/dates";

/**
 * The day the planner last named, kept for the app's run. The route is
 * where a day is named: a link, a strip tap, a page landing. This store
 * remembers the last one, so a return to the tab with no `day` param
 * opens on that day instead of today.
 *
 * It lives in the module, so a reload starts at today again. Nothing
 * here is written to disk or to settings.
 */
let picked: Date | null = null;

/** The day the planner last named, or null while it has named none. */
export function pickedDay(): Date | null {
  return picked;
}

/** Remember a day for the rest of the app's run, or forget it. */
export function rememberDay(day: Date | null): void {
  picked = day == null ? null : startOfDay(day);
}
