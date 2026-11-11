import * as React from "react";
import { View } from "react-native";
import { Split } from "@/components/motion/split";
import { motion } from "@/lib/motion/tokens";
import type { DayRows } from "@/features/planner/lib/day-rows";
import { isSameDay } from "@/utils/dates";
import { layout } from "../../planner-layout";
import { DayHeading } from "./day-heading";
import { DayListPane } from "./day-list-pane";
import { TimelinePane } from "./timeline-pane";

/**
 * One day's page: the heading, then the split of the timeline pane and
 * the list pane. The live day resizes through `Split`; the preview
 * draws the same fraction with `SplitStill`, so the swap between them
 * moves nothing.
 */
export const DayPage = React.memo(function DayPage({
  date,
  today,
  rows,
  now,
  fraction,
  onResize,
  onTimelineScroll,
  onListScroll,
}: {
  date: Date;
  today: Date;
  rows: DayRows;
  /** The minute the now line reads. One value serves the live page and
      its preview, so a swipe never shifts the line. */
  now: Date;
  /** The top pane's share of the split. */
  fraction: number;
  onResize: (fraction: number) => void;
  /** The panes' scroll offsets, so the preview can draw where the
      landed page will stand. */
  onTimelineScroll?: (y: number) => void;
  onListScroll?: (y: number) => void;
}) {
  return (
    <View style={layout.dayPage}>
      <DayHeading date={date} testID="day-heading" />
      <Split
        testID="day-split"
        fraction={fraction}
        onResize={onResize}
        minTop={motion.split.minPane}
        minBottom={motion.split.minPane}
        top={
          <TimelinePane
            tasks={rows.timed}
            isToday={isSameDay(date, today)}
            now={now}
            onScrollTop={onTimelineScroll}
          />
        }
        bottom={
          <DayListPane
            date={date}
            tasks={rows.sectionTasks}
            overdue={rows.overdue}
            onScrollTop={onListScroll}
          />
        }
      />
    </View>
  );
});
