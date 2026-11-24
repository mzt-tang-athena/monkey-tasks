import * as React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useToday } from "@/hooks/use-today";
import { recordBreadcrumb } from "@/lib/breadcrumbs";
import {
  parseMode,
  parsePlannerDay,
  plannerDayParam,
  type Mode,
} from "@/features/planner/model";
import { pickedDay, rememberDay } from "@/features/planner/lib/picked-day";

/** The planner route state: the mode the URL names and the day the
    screen opens on. */
export type PlannerRoute = {
  mode: Mode;
  day: Date;
  /** The start of today. It moves on at midnight. */
  today: Date;
  setMode: (next: Mode) => void;
  setDay: (next: Date) => void;
  openDay: (next: Date) => void;
};

/**
 * The planner's URL params as state. A link, or a day tapped on another
 * screen, only changes the query string, and the screen reads it back
 * from here.
 *
 * A route that names no day opens on the last day the planner named,
 * so leaving for another tab and coming back keeps the day. That holds
 * while the app runs. With no day named yet, it opens on today, which
 * moves on at midnight.
 */
export function usePlannerRoute(): PlannerRoute {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    day?: string | string[];
  }>();
  const today = useToday();
  const mode = parseMode(params.mode);
  const named = React.useMemo(() => parsePlannerDay(params.day), [params.day]);
  const day = named ?? pickedDay() ?? today;
  React.useEffect(() => {
    if (named != null) {
      rememberDay(named);
    }
  }, [named]);
  // The writes keep their identity, so a screen can pass them down.
  const setMode = React.useCallback(
    (next: Mode) => {
      recordBreadcrumb("tab", `planner:${next}`);
      router.setParams({ mode: next });
    },
    [],
  );
  const setDay = React.useCallback(
    (next: Date) => router.setParams({ day: plannerDayParam(next) }),
    [],
  );
  const openDay = React.useCallback(
    (next: Date) => {
      recordBreadcrumb("tab", "planner:day");
      router.setParams({ day: plannerDayParam(next), mode: "day" });
    },
    [],
  );
  return { mode, day, today, setMode, setDay, openDay };
}
