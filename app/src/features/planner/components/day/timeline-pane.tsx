import * as React from "react";
import { View } from "react-native";
import type { TaskItem } from "@/types/task";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { SectionHeader } from "@/components/ui/section-header";
import { layout } from "../../planner-layout";
import { Timeline } from "../timeline";

/**
 * The timeline pane: the section header over the ruler, in the split's
 * top pane. The ruler scrolls inside the pane and holds still while a
 * drag is active. The swipe preview draws the same pane with `copy`, so
 * it carries no targets and no test ids.
 */
export const TimelinePane = React.memo(function TimelinePane({
  tasks,
  isToday,
  now,
  copy = false,
}: {
  /** The day's tasks that carry a time. */
  tasks: TaskItem[];
  isToday: boolean;
  now: Date;
  /** A still copy: no drop zones and no drag sources. */
  copy?: boolean;
}) {
  return (
    <View style={layout.pane}>
      <SectionHeader label="Timeline" count={tasks.length} />
      <MotionScrollView
        testID={copy ? undefined : "timeline-scroller"}
        style={layout.paneScroll}
        showsVerticalScrollIndicator={false}
      >
        <Timeline
          tasks={tasks}
          isToday={isToday}
          now={now}
          copy={copy}
          testID={copy ? undefined : "timeline-hour"}
        />
      </MotionScrollView>
    </View>
  );
});
