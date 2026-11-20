import * as React from "react";
import { View } from "react-native";
import type { TaskItem } from "@/types/task";
import type { WeekLayout } from "@/lib/settings";
import { Pager } from "@/components/motion/pager";
import type { PageFollow } from "@/components/motion/page-follow";
import { SplitFit } from "@/components/motion/split";
import { addDays } from "@/utils/dates";
import { useSetting } from "@/lib/settings-store";
import { dayIndexBetween, pillsForSource, startOfWeek } from "@/features/planner/model";
import { layout } from "../planner-layout";
import { usePlannerList } from "./planner-list-context";
import { TaskListSection } from "./task-list-section";
import { WeekView } from "./week-view";

/**
 * The week body: the seven day boxes, the divider, and under them the
 * list pane fed the week's placement pool. A swipe on the boxes turns
 * the week; the period strip stays still, and the pane under them does
 * not slide. The canvas keeps its height, so the split holds still and
 * the list clips at the divider.
 */
export function WeekPane({
  layout: weekLayout,
  tasks,
  openTasks,
  day,
  today,
  onSelect,
  onOpenDay,
  follow,
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
  /** The screen's pager link: the period mark and this pager share it. */
  follow?: PageFollow;
}) {
  const { source } = usePlannerList();
  const [weekStart] = useSetting("weekStart");
  const weekPool = React.useMemo(
    () => pillsForSource(tasks, source, startOfWeek(day, weekStart)),
    [tasks, source, day, weekStart],
  );

  // The week index counts from the week this pane mounted. The pager
  // reads it, and a landing keeps the picked weekday, so Tuesday stays
  // Tuesday.
  const [origin] = React.useState(() => startOfWeek(day, weekStart));
  const index =
    dayIndexBetween(origin.getTime(), startOfWeek(day, weekStart).getTime()) / 7;
  const onPage = React.useCallback(
    (next: number) => onSelect(addDays(day, 7 * (next - index))),
    [onSelect, day, index],
  );

  return (
    <SplitFit
      testID="week-split"
      top={
        <Pager
          testID="week-pager"
          index={index}
          follow={follow}
          onPage={onPage}
          renderPreview={(page) => (
            <View style={layout.gutter}>
              <WeekView
                layout={weekLayout}
                tasks={openTasks}
                today={today}
                selected={addDays(day, 7 * (page - index))}
                weekStart={weekStart}
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
              weekStart={weekStart}
              interactive
              onSelect={onSelect}
              onOpenDay={onOpenDay}
            />
          </View>
        </Pager>
      }
      bottom={
        // Week's foot: the shared section in its own scrolling pane,
        // fed the week's placement pool.
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
      }
    />
  );
}
