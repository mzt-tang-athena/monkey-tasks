import * as React from "react";
import { StyleSheet, View } from "react-native";
import { SplitStill } from "@/components/motion/split";
import { PreviewRow } from "@/components/preview-row";
import type { TaskItem } from "@/types/task";
import { SectionHeader } from "@/components/ui/section-header";
import { dayRows } from "@/features/planner/lib/day-rows";
import { motion } from "@/lib/motion/tokens";
import { isSameDay } from "@/utils/dates";
import { spacing } from "@/theme/tokens";
import { layout } from "../../planner-layout";
import { FormToggle } from "../form-toggle";
import {
  PlannerListProvider,
  useInertList,
} from "../planner-list-context";
import { RowSeparator } from "../row-separator";
import { SourceToggle } from "../source-toggle";
import { TaskPills } from "../task-pills";
import { DayHeading } from "./day-heading";
import { TimelinePane } from "./timeline-pane";

/**
 * The neighbouring day as the swipe reveals it: the same rows and the
 * same `now` as the live day, held still. The split draws through
 * `SplitStill`, so the swap to the live body moves nothing. The rows
 * are still `PreviewRow`s, so a long list costs one picture, not a
 * list with hooks. Nothing here takes a pointer, so the gesture that
 * reveals it keeps owning the touch until it commits or springs back.
 */
export function DayPreview({
  date,
  today,
  tasks,
  now,
  fraction,
  scroll,
}: {
  date: Date;
  today: Date;
  tasks: TaskItem[];
  /** The minute the live day reads: one line, one value. */
  now: Date;
  /** The split the live day shows, drawn still. */
  fraction: number;
  /** The live panes' offsets. The still page draws at them, so the
      landing jumps nowhere. */
  scroll: { timeline: number; list: number };
}) {
  const inert = useInertList();
  const { source, taskForm } = inert;
  const rows = React.useMemo(
    () => dayRows({ tasks, day: date, today, source, taskForm }),
    [tasks, date, today, source, taskForm],
  );
  const pills = taskForm === "pills" && rows.sectionTasks.length > 0;
  const grouped =
    taskForm === "rows" && source === "due-period" && rows.overdue.length > 0;

  return (
    <PlannerListProvider value={inert}>
      <View style={[layout.dayPage, styles.preview]} pointerEvents="none">
        <DayHeading date={date} />
        <SplitStill
          testID="day-preview-split"
          fraction={fraction}
          minTop={motion.split.minPane}
          minBottom={motion.split.minPane}
          top={
            <TimelinePane
              tasks={rows.timed}
              isToday={isSameDay(date, today)}
              now={now}
              copy
              scrollTop={scroll.timeline}
            />
          }
          bottom={
            <View style={layout.paneList}>
              <View style={styles.listClip}>
                <View style={{ transform: [{ translateY: -scroll.list }] }}>
                  <View
                    style={[
                      styles.listHead,
                      pills
                        ? styles.headFlush
                        : grouped
                          ? styles.headGrouped
                          : styles.headRows,
                    ]}
                  >
                    <View style={styles.sectionHead}>
                      <SourceToggle mode="day" day={date} />
                      <View style={styles.spacer} />
                      <FormToggle />
                    </View>
                    {grouped ? (
                      <View style={styles.listHeadBody}>
                        <View style={styles.overdue}>
                          <SectionHeader
                            label="Overdue"
                            count={rows.overdue.length}
                            tone="danger"
                          />
                          <View>
                            {rows.overdue.map((task, index) => (
                              <React.Fragment key={task.id}>
                                {index > 0 ? <RowSeparator /> : null}
                                <PreviewRow
                                  task={task}
                                  done={task.data?.completed != null}
                                />
                              </React.Fragment>
                            ))}
                          </View>
                        </View>
                      </View>
                    ) : null}
                    {pills ? (
                      <View style={styles.listHeadBody}>
                        <TaskPills tasks={rows.sectionTasks} copy />
                      </View>
                    ) : null}
                  </View>
                  {pills ? null : (
                    <View style={styles.rows}>
                      {rows.sectionTasks.map((task, index) => (
                        <React.Fragment key={task.id}>
                          {index > 0 ? <RowSeparator /> : null}
                          <PreviewRow
                            task={task}
                            done={task.data?.completed != null}
                          />
                        </React.Fragment>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          }
        />
      </View>
    </PlannerListProvider>
  );
}

const styles = StyleSheet.create({
  // The live day page's spacing: heading, then the split.
  preview: {
    flex: 1,
    overflow: "hidden",
    gap: spacing.m,
  },
  // The same slots the live list draws: the section head, an optional
  // group header, then the rows.
  listHead: {
    gap: spacing.s,
  },
  listClip: {
    flex: 1,
    overflow: "hidden",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
  },
  spacer: {
    flex: 1,
  },
  listHeadBody: {
    gap: spacing.l,
  },
  headRows: {
    paddingBottom: spacing.s,
  },
  headGrouped: {
    paddingBottom: spacing.l,
  },
  headFlush: {
    paddingBottom: 0,
  },
  overdue: {
    gap: spacing.xs,
  },
  rows: {
    flexShrink: 1,
  },
});
