import * as React from "react";
import type { TaskItem } from "@/types/task";
import { useStableCallback } from "@/hooks/use-stable-callback";
import type { ListsSection } from "../lib/list-sections";
import { startTickHold, tickHoldMs, type TickHold } from "../lib/tick-hold";

/**
 * The tick's hold: the row stays in its place for a beat, so the
 * circle's own animation plays before the row regroups into Completed.
 * `toggle` takes the groups on screen, to read where the row sits.
 */
export function useTickHold(toggleTask: (task: TaskItem) => unknown) {
  const [hold, setHold] = React.useState<TickHold | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = React.useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  React.useEffect(() => clear, [clear]);

  const toggle = useStableCallback(
    (task: TaskItem, sections: ListsSection[]) => {
      const next =
        task.data?.completed != null ? null : startTickHold(sections, task);
      clear();
      // An untick needs no hold, a row on its way out keeps none, and
      // a second tap in the same beat calls the tick off.
      if (next == null || hold?.uri === task.uri) {
        setHold(null);
      } else {
        setHold(next);
        timer.current = setTimeout(() => {
          timer.current = null;
          setHold((current) => (current?.uri === task.uri ? null : current));
        }, tickHoldMs);
      }
      void toggleTask(task);
    },
  );

  return { hold, toggle };
}
