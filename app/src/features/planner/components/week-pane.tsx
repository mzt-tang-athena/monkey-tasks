import * as React from "react";
import { View } from "react-native";
import type { TaskItem } from "@/types/task";
import type { WeekLayout } from "@/lib/settings";
import { Pager } from "@/components/motion/pager";
import { PagePull } from "@/components/motion/pull";
import { addDays } from "@/utils/dates";
import { dayIndexBetween, pillsForSource, startOfWeek } from "@/features/planner/model";
import { useCommandPane } from "@/hooks/use-command-pane";
import { layout } from "../planner-layout";
import { usePlannerList } from "./planner-list-context";
import { TaskListSection } from "./task-list-section";
import { WeekView } from "./week-view";

/**
 * The week body: the seven day boxes, and under them the list pane fed
 * the week's placement pool. A swipe on the boxes turns the week; the
 * period strip stays still, and the pane under them does not slide.
 */
export function WeekPane({
  layout: weekLayout,
  tasks,
  openTasks,
  day,
  today,
  onSelect,
  onOpenDay,
}: {
  layout: WeekLayout;
  /** Every valid task: the pool draws from the source. */
  tasks: TaskItem[];
  /** The open tasks the day boxes draw. */
  openTasks: TaskItem[];
  day: Date;
  today: Date;
  onSelect: (day: Date) => void;
  onOpenDay: (day: Date) => void;
}) {
  const { source } = usePlannerList();
  const { show: showCommands } = useCommandPane();
  const weekPool = React.useMemo(
    () => pillsForSource(tasks, source, startOfWeek(day)),
    [tasks, source, day],
  );

  // The week index counts from the week this pane mounted. The pager
  // reads it, and a landing keeps the picked weekday, so Tuesday stays
  // Tuesday.
  const [origin] = React.useState(() => startOfWeek(day));
  const index = dayIndexBetween(origin.getTime(), startOfWeek(day).getTime()) / 7;
  const onPage = React.useCallback(
    (next: number) => onSelect(addDays(day, 7 * (next - index))),
    [onSelect, day, index],
  );

  return (
    <PagePull onPull={showCommands}>
      <View style={layout.weekBody}>
        <Pager
          testID="week-pager"
          index={index}
          onPage={onPage}
          renderPreview={(page) => (
            <View style={layout.gutter}>
              <WeekView
                layout={weekLayout}
                tasks={openTasks}
                today={today}
                selected={addDays(day, 7 * (page - index))}
                interactive={false}
              />
            </View>
          )}
        >
          <View style={layout.gutter}>
            <WeekView
              layout={weekLayout}
              tasks={openTasks}
              today={today}
              selected={day}
              interactive
              onSelect={onSelect}
              onOpenDay={onOpenDay}
            />
          </View>
        </Pager>
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
    </PagePull>
  );
}
