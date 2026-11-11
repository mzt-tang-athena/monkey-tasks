import * as React from "react";
import { View } from "react-native";
import type { TaskItem } from "@/types/task";
import { isSameDay } from "@/utils/dates";
import { layout } from "../../planner-layout";
import { usePlannerList } from "../planner-list-context";
import { TaskListSection } from "../task-list-section";
import { OverdueGroup } from "./overdue-group";

/**
 * The list pane: the shared bottom-half section under the divider.
 * Its source picks the rows, and dragging a row up into the ruler sets
 * its time. In the rows form on the due period, today's overdue tasks
 * head the list. The pane takes its rows as props and never reads the
 * hover, so a drag over the ruler leaves it alone.
 */
export const DayListPane = React.memo(function DayListPane({
  date,
  tasks,
  overdue,
  onScrollTop,
  restorePage,
  restoreTop,
}: {
  date: Date;
  tasks: TaskItem[];
  overdue: TaskItem[];
  /** The list's scroll offset, for the surface's preview. */
  onScrollTop?: (y: number) => void;
  /** The page whose saved offset the list restores. */
  restorePage?: number;
  restoreTop?: number;
}) {
  const { today, source, taskForm } = usePlannerList();
  const header = React.useMemo(
    () =>
      taskForm === "rows" && source === "due-period" && overdue.length > 0 ? (
        <OverdueGroup tasks={overdue} />
      ) : undefined,
    [taskForm, source, overdue],
  );
  return (
    <View style={layout.paneList}>
      <TaskListSection
        style={layout.paneScroll}
        mode="day"
        day={date}
        tasks={tasks}
        header={header}
        onScrollTop={onScrollTop}
        restorePage={restorePage}
        restoreTop={restoreTop}
        emptyLabel={
          source === "due-period"
            ? isSameDay(date, today)
              ? "Nothing scheduled today."
              : "Nothing scheduled."
            : `Nothing on ${source} yet.`
        }
      />
    </View>
  );
});
