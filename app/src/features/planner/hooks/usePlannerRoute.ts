import * as React from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  parseMode,
  parsePlannerDay,
  plannerDayParam,
  type Mode,
} from "../model";

/** The planner route state: the mode and day the URL names. */
export type PlannerRoute = {
  mode: Mode;
  day: Date;
  setMode: (next: Mode) => void;
  setDay: (next: Date) => void;
  openDay: (next: Date) => void;
};

/**
 * The planner's URL params as state. The route is the source of
 * truth: a link, or a day tapped on another screen, only changes the
 * query string, and the screen reads it back from here.
 */
export function usePlannerRoute(): PlannerRoute {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    day?: string | string[];
  }>();
  // Today is captured once per mount, so a missing day param stays
  // the same Date across renders instead of a fresh start of day.
  const [today] = React.useState(() => new Date());
  const mode = parseMode(params.mode);
  const day = React.useMemo(
    () => parsePlannerDay(params.day, today),
    [params.day, today],
  );
  return {
    mode,
    day,
    setMode: (next) => router.setParams({ mode: next }),
    setDay: (next) => router.setParams({ day: plannerDayParam(next) }),
    openDay: (next) =>
      router.setParams({ day: plannerDayParam(next), mode: "day" }),
  };
}
