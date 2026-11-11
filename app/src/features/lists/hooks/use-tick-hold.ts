import * as React from "react";
import type { TaskItem } from "@/types/task";
import { useStableCallback } from "@/hooks/use-stable-callback";
import type { ListsSection } from "../lib/list-sections";
import { startTickHold, type TickHold } from "../lib/tick-hold";

/**
 * The tick's hold: each ticked row stays in its place until the tick's
 * own animation ends and calls `settle`. Holds run at the same time,
 * and a map keeps them apart, so a second tick never moves the first
 * (ADR 0034). No timer decides when a hold ends.
 */
export function useTickHold(toggleTask: (task: TaskItem) => unknown) {
  const [holds, setHolds] = React.useState<ReadonlyMap<string, TickHold>>(
    () => new Map(),
  );

  const toggle = useStableCallback(
    (task: TaskItem, sections: ListsSection[]) => {
      if (task.data?.completed != null) {
        setHolds((current) => {
          if (!current.has(task.uri)) {
            return current;
          }
          const next = new Map(current);
          next.delete(task.uri);
          return next;
        });
      } else {
        const hold = startTickHold(sections, task);
        if (hold != null) {
          setHolds((current) => new Map(current).set(task.uri, hold));
        }
      }
      void toggleTask(task);
    },
  );

  const settle = useStableCallback((task: TaskItem) => {
    setHolds((current) => {
      if (!current.has(task.uri)) {
        return current;
      }
      const next = new Map(current);
      next.delete(task.uri);
      return next;
    });
  });

  const list = React.useMemo(() => [...holds.values()], [holds]);

  return { holds: list, toggle, settle };
}
