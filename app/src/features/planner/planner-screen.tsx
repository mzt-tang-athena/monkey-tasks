import * as React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CaptureTarget, TaskItem } from "@/types/task";
import { BottomBar } from "@/components/bottom-bar/bottom-bar";
import type { DockSlot } from "@/components/bottom-bar/dock-slot";
import { ErrorState, LoadingState } from "@/components/ui/list-states";
import { isoOf } from "@/utils/dates";
import { useSetting } from "@/lib/settings-store";
import { spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/theme-provider";
import { useTaskList, useStoreMeta } from "@/stores/tasks/task-state";
import { usePatchTask } from "@/stores/tasks/mutations/use-patch-task";
import { useToggleTask } from "@/stores/tasks/mutations/use-toggle-task";
import { useRefreshTasks } from "@/stores/tasks/use-vault-read";
import { useOpenTasks } from "@/stores/tasks/selectors";
import { layout } from "./planner-layout";
import { GhostPill } from "./components/ghost-pill";
import { DaySpread } from "./components/day/day-spread";
import { MonthPane } from "./components/month-pane";
import { usePlannerMonth } from "./hooks/use-planner-month";
import { PlannerHeader } from "./components/planner-header";
import {
  PlannerListProvider,
  type PlannerListValue,
} from "./components/planner-list-context";
import { SourceMenu } from "./components/source-menu";
import { WeekPane } from "./components/week-pane";
import { usePlannerRoute } from "./hooks/use-planner-route";
import { usePlannerSource } from "./hooks/use-planner-source";
import { patchForDrop, PlanDrag, type PlanTarget } from "./lib/plan-drag";

const TARGETS: CaptureTarget[] = [
  { kind: "list", name: "Focus" },
  { kind: "main" },
];

/**
 * The day split's starting share of the space under its divider. On the
 * suite's 412 by 915 viewport it gives the timeline 319 px, where the
 * layout used to settle; on a 360 by 640 screen the list starts at
 * 401 px, well above the bar at 585.
 */
const DAY_SPLIT = 0.51;

/**
 * The tasks the planner may show. A note that fails validation never
 * renders as a task row: the Lists screen shows it in its repair
 * block, and the planner leaves it out, so it never offers a broken
 * note to tick or drag.
 */
function useValid(tasks: TaskItem[]): TaskItem[] {
  return React.useMemo(
    () => tasks.filter((task) => (task.errors?.length ?? 0) === 0),
    [tasks],
  );
}

/**
 * The consolidated Planner tab, as a composition root. It reads the
 * route and the store, mounts the list context and the overlays, and
 * lays out the panes. Day, week and month share one drag surface:
 * rows, pills and hour tasks drop onto hour rows, week columns and
 * month cells, and `patchForDrop` turns the target into a write.
 */
export default function PlannerScreen({ dock }: { dock: DockSlot }) {
  // The mode and the day live in the URL: a link, a tap on another
  // screen, or a remount all read the same route state back.
  const { mode, day, today, setMode, setDay, openDay } = usePlannerRoute();
  const tasks = useValid(useTaskList());
  const openTasks = useValid(useOpenTasks());
  const { status } = useStoreMeta();
  const toggleTask = useToggleTask();
  const patchTask = usePatchTask();
  const refresh = useRefreshTasks();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // One global task form (rows or pills) for every planner mode,
  // live across the planner and the settings screen; default rows.
  const [taskForm, changeForm] = useSetting("taskForm");

  const openTask = React.useCallback((task: TaskItem) => {
    router.push(`/task/${encodeURIComponent(task.id)}`);
  }, []);

  const { source, cycle, choose, anchor, openMenu, closeMenu } =
    usePlannerSource();

  // The day split is screen state: written once per release, shared by
  // the live page and the swipe preview. It is not stored on disk.
  const [split, setSplit] = React.useState(DAY_SPLIT);

  // The month's picked day lives here, not in the pane, so it survives
  // a visit to Day or Week and back.
  const month = usePlannerMonth({ tasks, source, day });

  // One drop handler for every mode.
  const drop = React.useCallback(
    (task: TaskItem, target: PlanTarget) => {
      void patchTask(task, patchForDrop(task, target, day));
    },
    [patchTask, day],
  );

  // What every task list in the planner shares, whatever the mode.
  const list = React.useMemo<PlannerListValue>(
    () => ({
      today,
      source,
      cycleSource: cycle,
      menuOpen: anchor != null,
      openSourceMenu: openMenu,
      taskForm,
      changeForm,
      toggle: toggleTask,
      open: openTask,
    }),
    [today, source, cycle, anchor, openMenu, taskForm, changeForm, toggleTask, openTask],
  );

  return (
    <View
      testID="planner-screen"
      // The strip hangs from the top edge of the safe area. Where the
      // device has no inset, as in the web preview, it keeps a step
      // clear of the screen's edge.
      style={[
        layout.screen,
        {
          backgroundColor: colors.paper,
          paddingTop: Math.max(insets.top, spacing.s),
        },
      ]}
    >
      <PlanDrag.Root onDrop={drop} renderGhost={(task) => <GhostPill task={task} />}>
        <PlannerListProvider value={list}>
          {status === "ready" && mode === "day" ? (
            <DaySpread
              date={day}
              today={today}
              tasks={tasks}
              fraction={split}
              onResize={setSplit}
              onMode={setMode}
              onSelectStrip={setDay}
              onSelectDay={setDay}
            />
          ) : (
            // Week and month: a fixed frame. The header strip and the
            // calendar sit still; only the bottom task section scrolls,
            // inside its own pane, like the day split.
            <View style={layout.frame}>
              <PlannerHeader
                mode={mode}
                selected={day}
                today={today}
                onSelect={setDay}
                onMode={setMode}
                inset
              />
              {status === "loading" ? (
                <View style={layout.gutter}>
                  <LoadingState label="Loading tasks" />
                </View>
              ) : null}
              {status === "error" ? (
                <View style={layout.gutter}>
                  <ErrorState
                    message="Something went wrong."
                    retryLabel="Retry loading tasks"
                    onRetry={() => void refresh()}
                  />
                </View>
              ) : null}
              {status === "ready" && mode === "week" ? (
                <WeekPane
                  tasks={tasks}
                  openTasks={openTasks}
                  day={day}
                  today={today}
                  onSelect={setDay}
                  onOpenDay={openDay}
                />
              ) : null}
              {status === "ready" && mode === "month" ? (
                <MonthPane
                  month={month}
                  tasks={tasks}
                  day={day}
                  today={today}
                  onSelectMonth={setDay}
                  onOpenDay={openDay}
                />
              ) : null}
            </View>
          )}
        </PlannerListProvider>
      </PlanDrag.Root>

      <SourceMenu
        anchor={anchor}
        source={source}
        mode={mode}
        day={day}
        today={today}
        onChoose={choose}
        onClose={closeMenu}
      />

      {/* One bottom bar: nav left, capture button right. The planner
          preselects the viewed day as the default due date. */}
      <BottomBar
        action={dock({
          targets: TARGETS,
          defaultTargetIndex: 1,
          dueDay: isoOf(day),
        })}
      />
    </View>
  );
}
