import * as React from "react";
import { View } from "react-native";
import type { TaskItem } from "@/types/task";
import { dayOfZone } from "@/features/planner/lib/dropzone";
import { useDragHover, type DropTargets } from "@/features/planner/hooks/use-drag-session";
import { pillsForSource, startOfWeek } from "@/features/planner/model";
import { layout } from "../planner-layout";
import { usePlannerList } from "./planner-list-context";
import { TaskListSection } from "./task-list-section";
import { WeekView } from "./week-view";

/**
 * The week body: the day columns, and under them the list pane fed the
 * week's placement pool. The calendar sits still, and only the pane
 * scrolls.
 */
export function WeekPane({
  tasks,
  openTasks,
  day,
  today,
  onSelect,
  onOpenDay,
  drop,
}: {
  /** Every valid task: the pool draws from the source. */
  tasks: TaskItem[];
  /** The open tasks the columns draw. */
  openTasks: TaskItem[];
  day: Date;
  today: Date;
  /** A press on a column. The screen guards it against the click a
      drop leaves behind. */
  onSelect: (day: Date) => void;
  onOpenDay: (day: Date) => void;
  drop: DropTargets;
}) {
  const { source } = usePlannerList();
  const weekPool = React.useMemo(
    () => pillsForSource(tasks, source, startOfWeek(day)),
    [tasks, source, day],
  );
  const hoveredDay = dayOfZone(useDragHover(drop.hover));
  return (
    <View style={layout.weekBody}>
      <WeekView
        tasks={openTasks}
        today={today}
        selected={day}
        onSelect={onSelect}
        onOpenDay={onOpenDay}
        hoveredDay={hoveredDay}
        dropZones={drop.zones}
      />
      {/* Week's foot: the shared section in its own scrolling pane,
          fed the week's placement pool. */}
      <View style={[layout.paneList, layout.gutter]}>
        <TaskListSection
          style={layout.paneScroll}
          mode="week"
          day={day}
          tasks={weekPool}
          emptyLabel={
            source === "due-period"
              ? "Nothing to place this week."
              : `Nothing on ${source} yet.`
          }
        />
      </View>
    </View>
  );
}
