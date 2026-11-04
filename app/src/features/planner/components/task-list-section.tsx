import * as React from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { TaskItem } from "@/types/task";
import { TaskRow } from "@/components/task-row";
import type { Mode } from "@/features/planner/model";
import { colors, fonts, spacing } from "@/theme/tokens";
import { FormToggle } from "./form-toggle";
import { Pickup } from "./drag";
import { usePlannerList } from "./planner-list-context";
import { RowSeparator } from "./row-separator";
import { SourceToggle } from "./source-toggle";
import { TaskPills } from "./task-pills";

/** Pills mode has no rows, so the list renders header and footer only. */
const noTasks: TaskItem[] = [];

/**
 * The shared bottom-half task section: the source control on the
 * left, the small form toggle on the right, then the section's
 * tasks as rows or pills, the same data both ways. Day and Month
 * render this; Week renders it with its placement pool. An optional
 * header block carries a group header (overdue, tapped day) and an
 * optional footer carries the month's open-in-day-view link. Rows
 * ride a FlatList so long sources stay windowed; the section head,
 * header, pills and footer are its header and footer slots. A caller
 * may pass a style to size the list, e.g. inside a pane.
 *
 * The source, the form, the lift and the row actions come from
 * `PlannerListContext`. The section takes the period it names and its
 * rows.
 */
export const TaskListSection = React.memo(function TaskListSection({
  mode,
  day,
  tasks,
  emptyLabel,
  header,
  footer,
  style,
  copy = false,
}: {
  /** The mode and the day the source toggle names its period from. */
  mode: Mode;
  day: Date;
  tasks: TaskItem[];
  emptyLabel: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** The rows are a still copy (the day swipe preview), so they carry
      no test ids. */
  copy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { taskForm, lifted, api, toggle, open, dragStart } = usePlannerList();
  const pills = taskForm === "pills" && tasks.length > 0;

  const renderItem = React.useCallback<ListRenderItem<TaskItem>>(
    ({ item }) => (
      <Pickup
        task={item}
        api={api}
        lifted={lifted}
        onPointerDown={(e) => dragStart(item, e)}
      >
        <TaskRow task={item} onToggle={toggle} onOpen={open} copy={copy} />
      </Pickup>
    ),
    [api, lifted, dragStart, toggle, open, copy],
  );

  // A FlatList has no gap between its header slot and its first row,
  // so the list sets that gap on the slot itself (ADR 0012). Rows and
  // the empty label sit one step under the section head and two steps
  // under a group header. Pills end the slot, and the footer spaces
  // itself.
  const headStyle = pills ? styles.headFlush : header != null ? styles.headGrouped : styles.headRows;

  return (
    <FlatList
      style={style}
      data={taskForm === "rows" ? tasks : noTasks}
      keyExtractor={taskKey}
      renderItem={renderItem}
      ItemSeparatorComponent={RowSeparator}
      ListHeaderComponentStyle={headStyle}
      ListHeaderComponent={
        <View style={styles.listHead}>
          <View style={styles.sectionHead}>
            <SourceToggle mode={mode} day={day} />
            <View style={styles.spacer} />
            <FormToggle />
          </View>
          {header != null || pills ? (
            <View style={styles.listHeadBody}>
              {header}
              {/* Pills stay a wrapped grid inside the header, not list
                  items: each pill sizes itself to its label and the
                  grid reflows per row, which a vertical list cannot
                  do. */}
              {pills ? <TaskPills tasks={tasks} /> : null}
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        tasks.length === 0 ? <Text style={styles.empty}>{emptyLabel}</Text> : undefined
      }
      // The footer sits one step under the rows. Like the header slot,
      // the list sets that gap on the slot (ADR 0012).
      ListFooterComponentStyle={styles.footer}
      ListFooterComponent={footer == null ? undefined : <View>{footer}</View>}
      initialNumToRender={12}
      windowSize={7}
      maxToRenderPerBatch={12}
      removeClippedSubviews={false}
    />
  );
});

function taskKey(task: TaskItem): string {
  return task.id;
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
  },
  spacer: {
    flex: 1,
  },
  // The list's header slot: the section head, then a group header and
  // the pills one step further apart.
  listHead: {
    gap: spacing.s,
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
  footer: {
    paddingTop: spacing.s,
  },
  empty: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
