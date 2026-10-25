import { StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "../../tasks/query";
import { TaskRow } from "../../../components/TaskRow";
import type { TaskForm } from "../../../lib/settings";
import { spacing } from "../../../theme/tokens";
import { labelHour, MONTHS, WEEKDAYS_FULL } from "../lib/labels";
import {
  inSourceList,
  sortOpenFirst,
  tasksForDay,
  type Source,
} from "../model";
import { styles as base } from "./plannerStyles";

/** The peek's ruler spans the working day, 7 AM through 7 PM. */
const peekStart = 7;
const peekEnd = 19;

/**
 * The neighbouring day as the swipe reveals it: the same heading and
 * ruler as the day spread, its tasks as inert rows. Nothing here
 * takes a pointer, so the gesture that reveals it keeps owning the
 * touch until it commits or springs back.
 */
export function DayPreview({
  date,
  tasks,
  source,
}: {
  date: Date;
  tasks: TaskItem[];
  source: Source;
  /** Accepted with the spread's shape; the peek always shows rows. */
  taskForm: TaskForm;
}) {
  const dayTasks = tasksForDay(tasks, date);
  const rows = sortOpenFirst(
    source === "due-period"
      ? dayTasks
      : dayTasks.filter((task) => inSourceList(task, source)),
  );
  const hours: number[] = [];
  for (let hour = peekStart; hour <= peekEnd; hour++) {
    hours.push(hour);
  }

  return (
    <View style={styles.preview} pointerEvents="none">
      <Text style={base.dateMonth}>
        {MONTHS[date.getMonth()]} {date.getFullYear()}
      </Text>
      <Text style={base.dateHeader}>
        {WEEKDAYS_FULL[date.getDay()]} {date.getDate()}
      </Text>
      <View style={base.dateRule} />

      <View style={styles.rulerPane}>
        {hours.map((hour) => (
          <View key={hour} style={[base.rulerRow, styles.hourRow]}>
            <Text style={base.rulerMark}>{labelHour(hour)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.listPane}>
        {rows.length === 0 ? (
          <Text style={base.empty}>Nothing scheduled.</Text>
        ) : (
          rows.map((task, index) => (
            <View key={task.id}>
              {index > 0 ? <View style={base.groupRow} /> : null}
              <TaskRow task={task} />
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    flex: 1,
    overflow: "hidden",
  },
  // The peek's ruler is denser than the live one so most of the
  // working day reads above the tasks instead of scrolling.
  hourRow: {
    minHeight: 30,
  },
  rulerPane: {
    flexShrink: 1,
    overflow: "hidden",
  },
  listPane: {
    flex: 1,
    minHeight: 0,
    paddingTop: spacing.s,
    overflow: "hidden",
  },
});
