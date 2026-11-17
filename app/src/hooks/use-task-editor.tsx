import * as React from "react";

/** What a screen reads to open the task editor. */
export type TaskEditorValue = {
  /** Opens the editor sheet for the task with this id. */
  open: (id: string) => void;
  /** True while the editor sheet shows. */
  showing: boolean;
};

/**
 * The editor's opener, provided above every screen. The fallback keeps
 * a screen renderable on its own, as a unit test does. The app mounts
 * one provider above the stack, so the fallback never runs there.
 */
export const TaskEditorContext = React.createContext<TaskEditorValue>({
  open: () => {},
  showing: false,
});

/** The editor's opener, for a row press on Lists or Planner. */
export function useTaskEditor(): TaskEditorValue {
  return React.useContext(TaskEditorContext);
}
