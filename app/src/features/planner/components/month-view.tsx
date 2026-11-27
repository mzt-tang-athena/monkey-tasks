import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { Pager } from "@/components/motion/pager";
import type { PageFollow } from "@/components/motion/page-follow";
import { SplitFit } from "@/components/motion/split";
import { startOfMonth } from "@/features/planner/model";
import { pageGutter } from "@/theme/tokens";
import { MonthGrid, type PickedDay } from "./month-grid";

/** The months between two month starts, as a page index. */
function monthIndex(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

/** The fixed half of the month: the title and the grid card, over the
    picked-day list pane the container passes as children. The card
    keeps its height, so the split holds still and the list clips at
    the divider. */
export function MonthView({
  viewMonth,
  today,
  tasks,
  picked,
  onPick,
  onSelectMonth,
  follow,
  collapsed,
  onToggle,
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
  /** The screen's pager link: the period mark and this pager share it. */
  follow?: PageFollow;
  /** The list pane is hidden: the card takes its room. */
  collapsed?: boolean;
  onToggle?: () => void;
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
      <SplitFit
        testID="month-split"
        collapsed={collapsed}
        onToggle={onToggle}
        top={
          <Pager
            testID="month-pager"
            stretch
            index={index}
            follow={follow}
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
        }
        bottom={children}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The month sits in the week and month frame, which has no gutter.
  // The split's divider spaces the card from the list, so the column
  // carries no gap of its own.
  column: {
    flex: 1,
    paddingHorizontal: pageGutter,
  },
});
