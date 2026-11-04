import { SegmentedControl, type Segment } from "@/components/ui/segmented-control";
import type { TaskForm } from "@/lib/settings";
import { usePlannerList } from "./planner-list-context";

const segments: Segment<TaskForm>[] = [
  { key: "rows", icon: "rows", accessibilityLabel: "list form" },
  { key: "pills", icon: "pill", accessibilityLabel: "pill form" },
];

/**
 * The form toggle at the bottom half's right edge: rows (ticked list)
 * or pills (drag-first chips). Presentation only; the data is the same
 * either way.
 */
export function FormToggle() {
  const { taskForm, changeForm } = usePlannerList();
  return (
    <SegmentedControl
      segments={segments}
      selected={taskForm}
      onSelect={changeForm}
      label="task form"
    />
  );
}
