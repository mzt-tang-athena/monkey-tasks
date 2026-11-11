import * as React from "react";
import {
  PlannerListProvider,
  type PlannerListValue,
} from "@/features/planner/components/planner-list-context";

const noop = () => undefined;

/** Monday 26 October 2026: the day the suite pins. */
export const testToday = new Date(2026, 9, 26);

/** A list context with every action a no-op. A test passes the parts
    it reads. */
export function plannerListValue(
  overrides: Partial<PlannerListValue> = {},
): PlannerListValue {
  return {
    today: testToday,
    source: "due-period",
    cycleSource: noop,
    menuOpen: false,
    openSourceMenu: noop,
    taskForm: "rows",
    changeForm: noop,
    toggle: noop,
    open: noop,
    ...overrides,
  };
}

/** Mounts `children` under a list context, as the planner screen does. */
export function TestPlannerList({
  value,
  children,
}: {
  value?: Partial<PlannerListValue>;
  children: React.ReactNode;
}) {
  return (
    <PlannerListProvider value={plannerListValue(value)}>
      {children}
    </PlannerListProvider>
  );
}
