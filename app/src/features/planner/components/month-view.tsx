import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { Pager } from "@/components/motion/pager";
import { startOfMonth } from "@/features/planner/model";
import { pageGutter, spacing } from "@/theme/tokens";
import { MonthGrid, type PickedDay } from "./month-grid";

/** The months between two month starts, as a page index. */
function monthIndex(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

/** The fixed half of the month: the title and the grid card. The
    container passes the picked-day list pane as children, so both
    halves share one column. */
export function MonthView({
  viewMonth,
  today,
  tasks,
  picked,
  onPick,
  onSelectMonth,
  children,
}: {
  viewMonth: Date;
  today: Date;
  tasks: TaskItem[];
  /** The container owns the pick; the card only renders it. */
  picked: PickedDay;
  onPick: (day: Date) => void;
  /** A strip tap or a page landing picks the month. */
  onSelectMonth: (month: Date) => void;
  /** The picked-day list pane; both halves share one column. */
  children?: React.ReactNode;
}) {
  // The month index counts from the month this screen mounted. The
  // pager reads it, and a landing writes the month back.
  const [origin] = React.useState(() => startOfMonth(viewMonth));
  const index = monthIndex(origin, viewMonth);
  const onPage = React.useCallback(
    (next: number) => {
      onSelectMonth(new Date(origin.getFullYear(), origin.getMonth() + next, 1));
    },
    [onSelectMonth, origin],
  );
  const monthAt = (page: number) =>
    new Date(origin.getFullYear(), origin.getMonth() + page, 1);

  return (
    <View style={styles.column}>
      <View style={styles.fixed}>
        <Pager
          testID="month-pager"
          index={index}
          onPage={onPage}
          renderPreview={(page) => (
            <MonthGrid
              viewMonth={monthAt(page)}
              tasks={tasks}
              today={today}
              picked={picked}
              interactive={false}
            />
          )}
        >
          <MonthGrid
            viewMonth={viewMonth}
            tasks={tasks}
            today={today}
            picked={picked}
            interactive
            onPick={onPick}
          />
        </Pager>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // The month sits in the week and month frame, which has no gutter.
  column: {
    flex: 1,
    gap: spacing.m,
    paddingHorizontal: pageGutter,
  },
  // The fixed half: title and grid card. Its own swipe zone shifts
  // months without touching the row drags beneath.
  fixed: {
    flexShrink: 0,
  },
});
