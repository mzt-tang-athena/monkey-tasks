import * as React from "react";
import { View } from "react-native";
import type { DayRows } from "@/features/planner/lib/day-rows";
import type { DropTargets } from "@/features/planner/hooks/use-drag-session";
import type { SplitPane } from "@/features/planner/hooks/use-split-pane";
import { isSameDay } from "@/utils/dates";
import { layout } from "../../planner-layout";
import { DayHeading } from "./day-heading";
import { DayListPane } from "./day-list-pane";
import { SplitHandle } from "./split-handle";
import { TimelinePane } from "./timeline-pane";

/**
 * One day's page: the heading, then the split of the timeline pane,
 * the divider and the list pane. The live day and the swipe preview
 * both draw it, so the swap between them moves nothing. The live page
 * passes `drop` and `split`. The preview passes neither, and `copy`.
 */
export const DayPage = React.memo(function DayPage({
  date,
  today,
  rows,
  timelineHeight,
  drop,
  split,
  copy = false,
}: {
  date: Date;
  today: Date;
  rows: DayRows;
  timelineHeight: number;
  drop?: DropTargets;
  split?: SplitPane;
  copy?: boolean;
}) {
  // The now line reads the minute, so a page keeps one value a minute.
  const minute = Math.floor(Date.now() / 60_000);
  const now = React.useMemo(() => new Date(minute * 60_000), [minute]);
  return (
    <View style={layout.dayPage}>
      <DayHeading date={date} testID={copy ? undefined : "day-heading"} />
      {/* The split opens with the timeline pane, so its top is the
          pane's top. */}
      <View style={layout.daySplit} onLayout={split == null ? undefined : (e) => split.onSplitLayout(e.nativeEvent.layout.y)}>
        <TimelinePane
          tasks={rows.timed}
          isToday={isSameDay(date, today)}
          now={now}
          height={timelineHeight}
          drop={drop}
        />
        <SplitHandle split={split ?? null} />
        <DayListPane
          copy={copy}
          date={date}
          tasks={rows.sectionTasks}
          overdue={rows.overdue}
        />
      </View>
    </View>
  );
});
