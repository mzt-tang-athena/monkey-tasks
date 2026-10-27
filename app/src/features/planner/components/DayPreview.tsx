import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "../../tasks/query";
import type { TaskForm } from "../../../lib/settings";
import { DropZoneMap } from "../../../lib/dropzone";
import { MONTHS, WEEKDAYS_FULL } from "../lib/labels";
import {
  hasTime,
  inSourceList,
  isoOf,
  sortOpenFirst,
  type Source,
} from "../model";
import { TaskListSection } from "./TaskListSection";
import { Timeline } from "./Timeline";
import { styles as base } from "./plannerStyles";
import { spacing } from "../../../theme/tokens";

/** Nothing in the preview reacts; every handler the live body
 *  supplies is replaced by this one. */
const noop = () => undefined;

/**
 * The neighbouring day as the swipe reveals it: the same markup the
 * day spread builds, painted inert. Nothing here takes a pointer, so
 * the gesture that reveals it keeps owning the touch until it commits
 * or springs back, and the swap to the live body moves nothing.
 */
export function DayPreview({
  date,
  tasks,
  source,
  taskForm,
  timelineHeight,
}: {
  date: Date;
  tasks: TaskItem[];
  source: Source;
  taskForm: TaskForm;
  timelineHeight: number;
}) {
  // The ruler registers its rows under their hours; the preview never
  // hit-tests them, but the map must hold steady across renders.
  const [zones] = React.useState(() => new DropZoneMap());

  // The spread's rows: the whole day, completed ones kept, then the
  // source's own pool when it is not the day.
  const dayTasks = sortOpenFirst(
    tasks.filter(
      (task) => task.data?.due != null && task.data.due.slice(0, 10) === isoOf(date),
    ),
  );
  const timed = dayTasks.filter(hasTime);
  const listRows =
    source === "due-period"
      ? dayTasks
      : sortOpenFirst(tasks.filter((task) => inSourceList(task, source)));
  // The pills pool folds the overdue group in first; the preview has
  // no overdue group of its own, so it is an empty prefix.
  const sectionTasks =
    taskForm === "pills" && source === "due-period"
      ? sortOpenFirst([...listRows])
      : listRows;

  return (
    <View style={styles.preview} pointerEvents="none">
      {/* Compact day heading: eyebrow, short serif date, accent rule. */}
      <View style={base.dayHeading}>
        <View>
          <Text style={base.dateMonth}>
            {MONTHS[date.getMonth()]} {date.getFullYear()}
          </Text>
          <Text style={base.dateHeader}>
            {WEEKDAYS_FULL[date.getDay()]} {date.getDate()}
          </Text>
        </View>
        <View style={base.dateRule} />
      </View>

      <View style={base.daySplit}>
      {/* The timeline pane at the live split's height. */}
      <View style={[base.pane, { height: timelineHeight }]}>
        <Text style={base.sectionLabel}>Timeline  {timed.length}</Text>
        <ScrollView style={base.paneScroll} showsVerticalScrollIndicator={false}>
          <Timeline
            tasks={timed}
            isToday={false}
            now={new Date()}
            dragActive={false}
            hoverHour={null}
            zones={zones}
            lifted={null}
            onToggle={noop}
            onDragStart={noop}
          />
        </ScrollView>
      </View>

      {/* The dashed drop line and its grabber, at rest. */}
      <View style={base.divider}>
        <View style={base.dividerLine} />
        <View
          style={base.grabberHit}
          accessibilityRole="button"
          accessibilityLabel="resize timeline"
        >
          <View style={base.grabberBar} />
        </View>
      </View>

      {/* The task list pane: source chip, form toggle, the rows. */}
      <View style={base.paneList}>
        <TaskListSection
          copy
          style={base.paneScroll}
          source={source}
          mode="day"
          sourceMenuOpen={false}
          onCycleSource={noop}
          onOpenSourceMenu={noop}
          taskForm={taskForm}
          onFormChange={noop}
          onToggle={noop}
          onDragStart={noop}
          tasks={sectionTasks}
          emptyLabel={
            source === "due-period"
              ? "Nothing scheduled today."
              : `Nothing on ${source} yet.`
          }
        />
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The live day page's spacing: heading, then the split.
  preview: {
    flex: 1,
    overflow: "hidden",
    gap: spacing.m,
  },
});
