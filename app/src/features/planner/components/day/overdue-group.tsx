import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { TaskRow } from "@/components/task-row";
import { SectionHeader } from "@/components/ui/section-header";
import { spacing } from "@/theme/tokens";
import { Pickup } from "../drag";
import { usePlannerList } from "../planner-list-context";
import { RowSeparator } from "../row-separator";

/**
 * Today's overdue tasks: a danger header, then the rows with the same
 * hairline the list below draws between its own. Each row is a drag
 * source, like every other row.
 */
export function OverdueGroup({
  tasks,
  copy = false,
}: {
  tasks: TaskItem[];
  /** A still copy for the swipe preview: no test ids. */
  copy?: boolean;
}) {
  const { lifted, api, toggle, open, dragStart } = usePlannerList();
  return (
    <View testID={copy ? undefined : "overdue-group"} style={styles.group}>
      <SectionHeader label="Overdue" count={tasks.length} tone="danger" />
      <View>
        {tasks.map((task, index) => (
          <React.Fragment key={task.id}>
            {index > 0 ? <RowSeparator /> : null}
            <Pickup
              task={task}
              api={api}
              lifted={lifted}
              onPointerDown={(e) => dragStart(task, e)}
            >
              <TaskRow task={task} onToggle={toggle} onOpen={open} copy={copy} />
            </Pickup>
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
