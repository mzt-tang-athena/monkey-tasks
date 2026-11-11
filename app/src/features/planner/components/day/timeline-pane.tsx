import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import {
  MotionScrollView,
  type MotionScrollRef,
} from "@/components/motion/scroll-view";
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
  onScrollTop,
  scrollTop,
  restorePage,
  restoreTop,
}: {
  /** The day's tasks that carry a time. */
  tasks: TaskItem[];
  isToday: boolean;
  now: Date;
  /** A still copy: no drop zones and no drag sources. */
  copy?: boolean;
  /** The live scroller's offset, for the surface. */
  onScrollTop?: (y: number) => void;
  /** The live offset the still copy draws at. */
  scrollTop?: number;
  /** The page whose saved offset the live scroller restores. */
  restorePage?: number;
  restoreTop?: number;
}) {
  const live = React.useRef<MotionScrollRef>(null);
  // A page change swaps the content and restores that page's offset
  // before paint, so the landing matches the preview.
  React.useLayoutEffect(() => {
    if (restoreTop === undefined) {
      return;
    }
    live.current?.scrollTo({ y: restoreTop, animated: false });
    onScrollTop?.(restoreTop);
  }, [restorePage, restoreTop, onScrollTop]);

  const ruler = (
    <Timeline
      tasks={tasks}
      isToday={isToday}
      now={now}
      copy={copy}
      testID={copy ? undefined : "timeline-hour"}
    />
  );

  return (
    <View style={layout.pane}>
      <SectionHeader label="Timeline" count={tasks.length} />
      {copy ? (
        <View style={[layout.paneScroll, styles.clip]}>
          <View style={{ transform: [{ translateY: -(scrollTop ?? 0) }] }}>
            {ruler}
          </View>
        </View>
      ) : (
        <MotionScrollView
          ref={live}
          testID="timeline-scroller"
          style={layout.paneScroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={
            onScrollTop == null
              ? undefined
              : (event) => onScrollTop(event.nativeEvent.contentOffset.y)
          }
        >
          {ruler}
        </MotionScrollView>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
  },
});
