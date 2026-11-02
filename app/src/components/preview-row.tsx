import * as React from "react";
import type { TaskItem } from "@/types/task";
import { TaskRowFace } from "./task-row-face";

/**
 * One task as a still picture: the face `TaskRow` draws, with no touch
 * target, no state and no animation. The pager paints a page with ~20
 * of these at the start of a gesture, so each must cost about what a
 * plain view costs. Both rows render `TaskRowFace`, so the preview
 * does not shift when the page becomes live.
 */
function PreviewRowBase({
  task,
  done = false,
  timeAlign = "under",
}: {
  task: TaskItem;
  /** The task's completed state, read by the caller from its data. */
  done?: boolean;
  /** "under" puts the time below the name; "right" adds a planner gutter. */
  timeAlign?: "under" | "right";
}) {
  return <TaskRowFace task={task} done={done} timeAlign={timeAlign} />;
}

/**
 * Still rows are pure over their task and state: a preview re-render
 * must not rebuild every row it shows.
 */
export const PreviewRow = React.memo(PreviewRowBase);
