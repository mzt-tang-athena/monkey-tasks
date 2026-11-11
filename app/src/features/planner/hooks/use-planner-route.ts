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

/** The planner route state: the mode and day the URL names. */
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
 * The planner's URL params as state. The route is the source of
 * truth: a link, or a day tapped on another screen, only changes the
 * query string, and the screen reads it back from here.
 */
export function usePlannerRoute(): PlannerRoute {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    day?: string | string[];
  }>();
  // A missing day param reads as today. The date keeps its identity
  // until midnight, and it is the same date the strip tints.
  const today = useToday();
  const mode = parseMode(params.mode);
  const day = React.useMemo(
    () => parsePlannerDay(params.day, today),
    [params.day, today],
  );
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
