import * as React from "react";
import { ScrollView, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { SectionHeader } from "@/components/ui/section-header";
import { DropZoneMap, hourOfZone } from "@/features/planner/lib/dropzone";
import { useDragHover, type DropTargets } from "@/features/planner/hooks/use-drag-session";
import { layout } from "../../planner-layout";
import { Timeline } from "../timeline";

/**
 * The timeline pane: the section header over the ruler, in a pane the
 * grabber resizes. It listens to the hover, so a drag over a new hour
 * re-renders this pane and nothing else in the day. The swipe preview
 * passes no `drop`: it draws the same pane, with no zones and no ids.
 */
export const TimelinePane = React.memo(function TimelinePane({
  tasks,
  isToday,
  now,
  height,
  drop,
}: {
  /** The day's tasks that carry a time. */
  tasks: TaskItem[];
  isToday: boolean;
  now: Date;
  height: number;
  drop?: DropTargets;
}) {
  const hoverHour = hourOfZone(useDragHover(drop?.hover ?? null));
  // The preview never hit-tests its rows, but the map must hold steady
  // across renders.
  const [spare] = React.useState(() => new DropZoneMap());
  return (
    <View ref={drop?.clip} style={[layout.pane, { height }]}>
      <SectionHeader label="Timeline" count={tasks.length} />
      <ScrollView style={layout.paneScroll} showsVerticalScrollIndicator={false}>
        <Timeline
          tasks={tasks}
          isToday={isToday}
          now={now}
          hoverHour={hoverHour}
          zones={drop?.zones ?? spare}
          testID={drop == null ? undefined : "timeline-hour"}
        />
      </ScrollView>
    </View>
  );
});

