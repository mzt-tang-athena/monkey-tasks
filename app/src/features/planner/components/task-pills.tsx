import { Text, View, type PointerEvent as RNPointerEvent } from "react-native";
import type { TaskItem } from "@/types/task";
import { pillDateLabel } from "@/features/planner/lib/labels";
import { Pickup, type DragApi, type LiftState } from "./drag";
import { styles } from "./planner-styles";

/** Round-1 tray pills, back as draggable chips: drag-first, no tick. */
export function TaskPills({
  tasks,
  onDragStart,
  lifted,
  api,
}: {
  tasks: TaskItem[];
  onDragStart: (task: TaskItem, e: RNPointerEvent, kind?: "pill" | "row") => void;
  lifted?: LiftState;
  api?: DragApi;
}) {
  if (tasks.length === 0) {
    return null;
  }
  return (
    <View style={styles.pillsWrap}>
      {tasks.map((task) => (
        <Pickup
          key={task.id}
          task={task}
          kind="pill"
          api={api}
          lifted={lifted ?? null}
          onPointerDown={(e) => onDragStart(task, e, "pill")}
          style={styles.pillChip}
        >
          <View style={styles.pillGrip}>
            <View style={styles.pillGripDot} />
            <View style={styles.pillGripDot} />
          </View>
          {/* A placed pill carries its date; dragging moves it. */}
          {task.data?.due != null ? (
            <Text style={styles.pillDate}>{pillDateLabel(task)}</Text>
          ) : null}
          <Text style={styles.pillText} numberOfLines={1}>
            {task.name}
          </Text>
        </Pickup>
      ))}
    </View>
  );
}
