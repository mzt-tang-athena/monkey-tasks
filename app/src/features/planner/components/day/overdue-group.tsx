import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { TaskRow } from "@/components/task-row";
import { SectionHeader } from "@/components/ui/section-header";
import { PlanDrag } from "@/features/planner/lib/plan-drag";
import { spacing } from "@/theme/tokens";
import { usePlannerList } from "../planner-list-context";
import { RowSeparator } from "../row-separator";

/**
 * Today's overdue tasks: a danger header, then the rows with the same
 * hairline the list below draws between its own. Each row is a drag
 * source, like every other row.
 */
export function OverdueGroup({ tasks }: { tasks: TaskItem[] }) {
  const { toggle, open } = usePlannerList();
  return (
    <View testID="overdue-group" style={styles.group}>
      <SectionHeader label="Overdue" count={tasks.length} tone="danger" />
      <View>
        {tasks.map((task, index) => (
          <React.Fragment key={task.id}>
            {index > 0 ? <RowSeparator /> : null}
            <PlanDrag.Source payload={task} hold="row" testID={`task-source:${task.name}`}>
              <TaskRow task={task} onToggle={toggle} onOpen={open} panPress />
            </PlanDrag.Source>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.xs,
  },
});
