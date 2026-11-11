import * as React from "react";
import type { TaskItem } from "@/types/task";
import type { TaskForm } from "@/lib/settings";
import type { Source } from "@/features/planner/model";
import type { MenuAnchor } from "@/features/planner/hooks/use-planner-source";

/**
 * What every task list in the planner shares, whatever the mode: the
 * source and its chooser, the form, and the actions a row runs. The
 * screen builds one value and mounts it once, so the day body, the week
 * pane and the month pane take none of this as props.
 */
export type PlannerListValue = {
  /** The start of today: the source toggle names its period from it. */
  today: Date;
  source: Source;
  cycleSource: () => void;
  /** The chooser is open: a tap on the toggle then does nothing. */
  menuOpen: boolean;
  openSourceMenu: (anchor: MenuAnchor) => void;
  taskForm: TaskForm;
  changeForm: (form: TaskForm) => void;
  toggle: (task: TaskItem) => void;
  open: (task: TaskItem) => void;
};

const PlannerListContext = React.createContext<PlannerListValue | null>(null);

export const PlannerListProvider = PlannerListContext.Provider;

export function usePlannerList(): PlannerListValue {
  const value = React.useContext(PlannerListContext);
  if (value == null) {
    throw new Error("usePlannerList needs a PlannerListProvider above it");
  }
  return value;
}

const noop = () => undefined;

/**
 * The same list, held still: no lift, no drag source, no action. The
 * swipe preview mounts this around its still day, so the preview
 * shows what the live page will show and answers nothing.
 */
export function useInertList(): PlannerListValue {
  const live = usePlannerList();
  const { today, source, taskForm } = live;
  return React.useMemo(
    () => ({
      today,
      source,
      cycleSource: noop,
      menuOpen: false,
      openSourceMenu: noop,
      taskForm,
      changeForm: noop,
      toggle: noop,
      open: noop,
    }),
    [today, source, taskForm],
  );
}
