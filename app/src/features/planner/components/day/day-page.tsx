import * as React from "react";
import { View } from "react-native";
import { Split, SplitStill } from "@/components/motion/split";
import { motion } from "@/lib/motion/tokens";
import type { DayRows } from "@/features/planner/lib/day-rows";
import { isSameDay } from "@/utils/dates";
import { layout } from "../../planner-layout";
import { DayHeading } from "./day-heading";
import { DayListPane } from "./day-list-pane";
import { TimelinePane } from "./timeline-pane";

/**
 * One day's page: the heading, then the split of the timeline pane and
 * the list pane. The live day resizes through `Split`; the swipe
 * preview draws the same fraction through `SplitStill`, so the swap
 * between them moves nothing.
 */
export const DayPage = React.memo(function DayPage({
  date,
  today,
  rows,
  fraction,
  onResize,
  copy = false,
}: {
  date: Date;
  today: Date;
  rows: DayRows;
  /** The top pane's share of the split. */
  fraction: number;
  /** The live day's resize. Absent, the page is a still preview. */
  onResize?: (fraction: number) => void;
  copy?: boolean;
}) {
  // The now line reads the minute, so a page keeps one value a minute.
  const minute = Math.floor(Date.now() / 60_000);
  const now = React.useMemo(() => new Date(minute * 60_000), [minute]);
  const top = (
    <TimelinePane
      tasks={rows.timed}
      isToday={isSameDay(date, today)}
      now={now}
      copy={copy}
    />
  );
  const bottom = (
    <DayListPane
      copy={copy}
      date={date}
      tasks={rows.sectionTasks}
      overdue={rows.overdue}
    />
  );
  return (
    <View style={layout.dayPage}>
      <DayHeading date={date} testID={copy ? undefined : "day-heading"} />
      {onResize == null ? (
        <SplitStill
          testID={copy ? undefined : "day-split"}
          fraction={fraction}
          minTop={motion.split.minPane}
          minBottom={motion.split.minPane}
          top={top}
          bottom={bottom}
        />
      ) : (
        <Split
          testID="day-split"
          fraction={fraction}
          onResize={onResize}
          minTop={motion.split.minPane}
          minBottom={motion.split.minPane}
          top={top}
          bottom={bottom}
        />
      )}
    </View>
  );
});
