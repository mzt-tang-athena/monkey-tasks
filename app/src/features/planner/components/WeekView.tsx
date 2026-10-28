import {
  Pressable,
  ScrollView,
  Text,
  View,
  type PointerEvent as RNPointerEvent,
} from "react-native";
import type { TaskItem } from "@/types/task";
import { DropZoneMap } from "@/features/planner/lib/dropzone";
import { addDays, isoOf, isSameDay, startOfDay } from "@/utils/dates";
import {
  hasTime,
  sortByTimeOfDay,
  startOfWeek,
  tasksForDay,
  timeOf,
} from "@/features/planner/model";
import { WEEKDAYS, WEEKDAYS_FULL } from "@/features/planner/lib/labels";
import { Pickup, type DragApi, type LiftState } from "./drag";
import { styles } from "./plannerStyles";


/** F's week body: day columns with real content, one swipe away. */
export function WeekView({
  tasks,
  today,
  selected,
  onSelect,
  onDragTask,
  dragActive,
  hoveredDay,
  dropZones,
  lifted,
  api,
}: {
  tasks: TaskItem[];
  today: Date;
  selected: Date;
  onSelect: (date: Date) => void;
  /** Week day cards drag between columns, like the pool rows do. */
  onDragTask: (task: TaskItem, e: RNPointerEvent) => void;
  api?: DragApi;
  dragActive: boolean;
  hoveredDay: Date | null;
  /** The columns register here; moves hit-test instead of relying
      on enter/leave events, which touch never delivers. */
  dropZones: DropZoneMap;
  lifted: LiftState;
}) {
  const todayStart = startOfDay(today).getTime();
  // The strip picks the week; its seven columns start on Sunday.
  const weekStart = startOfWeek(selected);
  const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(weekStart, offset));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.weekScroller}
      contentContainerStyle={styles.weekCanvas}
    >
      {days.map((day) => {
        const items = sortByTimeOfDay(tasksForDay(tasks, day));
        const isToday = startOfDay(day).getTime() === todayStart;
        const isSelected =
          startOfDay(day).getTime() === startOfDay(selected).getTime();
        const isHovered = dragActive && isSameDay(day, hoveredDay);
        return (
          <Pressable
            key={day.getTime()}
            style={({ pressed }) => [
              styles.weekCol,
              isSelected && !isToday && styles.weekColSelected,
              isToday && styles.weekColToday,
              isHovered && styles.weekColHovered,
              pressed && styles.pressedFill,
            ]}
            ref={(node) => {
              dropZones.set(`day:${isoOf(day)}`, node);
            }}
            onPress={() => onSelect(day)}
            accessibilityRole="button"
            accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
          >
            <Text style={styles.weekDayName}>
              {isToday ? "Today" : WEEKDAYS[day.getDay()]}
            </Text>
            <Text
              style={[styles.weekDayNum, isToday && styles.weekDayNumToday]}
            >
              {day.getDate()}
            </Text>
            <View style={styles.weekColRule} />
            {items.length > 0 ? (
              <View style={styles.weekTasks}>
                {items.map((task) => (
                  <Pickup
                    key={task.id}
                    task={task}
                    api={api}
                    lifted={lifted}
                    onPointerDown={(e) => onDragTask(task, e)}
                    style={styles.weekTask}
                  >
                    <View style={styles.taskBar} />
                    <Text style={styles.weekTaskText} numberOfLines={3}>
                      {hasTime(task) ? `${timeOf(task)}  ` : ""}
                      {task.name}
                    </Text>
                  </Pickup>
                ))}
              </View>
            ) : (
              <Text style={styles.weekFree}>free</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
