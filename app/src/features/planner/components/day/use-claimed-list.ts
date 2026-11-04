import * as React from "react";
import type { DragApi } from "../drag";
import type { PlannerListValue } from "../planner-list-context";

/**
 * The screen's list, plus the claim on every way a drag can start. A
 * pickup or a drag start tells the day swipe to stand down.
 *
 * The wrapped api and dragStart depend on the screen's api and
 * dragStart only, never on the lift. The native pan is memoized on the
 * api, and a pan rebuilt in the middle of a drag drops the gesture. So
 * the api keeps one identity through hold, arm and pickup.
 */
export function useClaimedList(
  live: PlannerListValue,
  claim: () => void,
): PlannerListValue {
  const { api: liveApi, dragStart: liveDragStart } = live;

  const api = React.useMemo<DragApi | undefined>(
    () =>
      liveApi == null
        ? undefined
        : {
            ...liveApi,
            pickup: (task, x, y, kind) => {
              // The hold already fired; a sideways drag must not also
              // shift the day when it ends.
              claim();
              liveApi.pickup(task, x, y, kind);
            },
          },
    [liveApi, claim],
  );

  const dragStart = React.useCallback<PlannerListValue["dragStart"]>(
    (task, e, kind) => {
      claim();
      liveDragStart(task, e, kind);
    },
    [liveDragStart, claim],
  );

  return React.useMemo(
    () => ({ ...live, api, dragStart }),
    [live, api, dragStart],
  );
}
