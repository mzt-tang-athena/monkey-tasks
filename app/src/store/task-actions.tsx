import * as React from "react";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "../features/tasks/query";
import type { CaptureTarget } from "../features/capture/write";
import type { ParsedCapture } from "../features/capture/parse";

/**
 * The store's write side: the operations a screen can run, kept apart
 * from the rows so a callback holder does not re-render on every read.
 * Mutations are local first; the note is written behind them. See ADR
 * 0017.
 */
export type TaskActions = {
  /** Drop the last failure once the user has seen it. */
  clearError(): void;
  grant(): Promise<void>;
  refresh(): Promise<void>;
  toggle(task: TaskItem): Promise<void>;
  writeFields(
    task: TaskItem,
    patch: Partial<TaskFrontmatter>,
  ): Promise<void>;
  capture(
    parsed: ParsedCapture,
    target: CaptureTarget,
    preselectedDue?: string,
  ): Promise<void>;
};

export const TaskActionsContext = React.createContext<TaskActions | null>(
  null,
);

export function useTaskActions(): TaskActions {
  const actions = React.useContext(TaskActionsContext);
  if (actions == null) {
    throw new Error("useTaskActions must run inside TasksProvider");
  }
  return actions;
}
