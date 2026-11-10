import * as React from "react";
import { addDays } from "@/utils/dates";

/**
 * The planner's day and month shifts. The day swipe and the month
 * swipe run them. Ticket 0059 moves both pagers onto `Pager`, and what
 * is left here then goes with them.
 */
export function usePlannerGestures({ day, setDay }: { day: Date; setDay: (next: Date) => void }) {
  // The shift reads the current day through a ref, so a controller
  // built once still lands on the day the screen shows.
  const dayRef = React.useRef(day);
  React.useEffect(() => {
    dayRef.current = day;
  }, [day]);
  const shiftDay = React.useCallback(
    (delta: 1 | -1) => setDay(addDays(dayRef.current, delta)),
    [setDay],
  );
  const shiftMonth = React.useCallback(
    (delta: 1 | -1) => {
      const current = dayRef.current;
      setDay(new Date(current.getFullYear(), current.getMonth() + delta, 1));
    },
    [setDay],
  );
  return { shiftDay, shiftMonth };
}
