import * as React from "react";
import { AppState } from "react-native";
import { startOfDay } from "@/utils/dates";

/** The first moment of the day after `day`. */
function nextMidnight(day: Date): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
}

/**
 * Today as a start-of-day date. The value keeps its identity until the
 * day changes, so a screen can use it as a dependency. It changes at
 * midnight, and when the app returns to the foreground after a night
 * asleep, because a timer does not run while the phone sleeps.
 */
export function useToday(): Date {
  const [today, setToday] = React.useState(() => startOfDay(new Date()));

  React.useEffect(() => {
    const refresh = () => {
      const now = startOfDay(new Date());
      setToday((current) => (current.getTime() === now.getTime() ? current : now));
    };
    const timer = setTimeout(refresh, Math.max(nextMidnight(today) - Date.now(), 0) + 1);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
      }
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  return today;
}
