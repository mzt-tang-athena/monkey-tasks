import * as React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CaptureTarget, TaskItem } from "@/types/task";
import { BottomBar } from "@/components/bottom-bar/bottom-bar";
import type { DockSlot } from "@/components/bottom-bar/dock-slot";
import { ErrorState, LoadingState } from "@/components/ui/list-states";
import { isoOf } from "@/utils/dates";
import { loadSettings, saveSetting, type TaskForm } from "@/lib/settings";
import { spacing } from "@/theme/tokens";
import { useTaskList, useStoreMeta } from "@/stores/tasks/task-state";
import { usePatchTask } from "@/stores/tasks/mutations/use-patch-task";
import { useToggleTask } from "@/stores/tasks/mutations/use-toggle-task";
import { useRefreshTasks } from "@/stores/tasks/use-vault-read";
import { useOpenTasks } from "@/stores/tasks/selectors";
import { layout } from "./planner-layout";
import { pointerPickup } from "./components/drag";
import { DragGhost } from "./components/drag-ghost";
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
import { usePlannerGestures } from "./hooks/use-planner-gestures";
import { usePlannerRoute } from "./hooks/use-planner-route";
import { usePlannerSource } from "./hooks/use-planner-source";

const TARGETS: CaptureTarget[] = [
  { kind: "list", name: "Focus" },
  { kind: "main" },
];

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
 * lays out the panes. Day mode is a fixed split of timeline and list.
 * Week is a horizontal canvas of day columns. Month is a card with
 * dots that lists a day's tasks on tap.
 *
 * The pure rules sit in features/planner/model and lib/day-rows. Drag
 * for all three modes runs in hooks/use-drag-session, and the day and
 * month shifts in hooks/use-planner-gestures.
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

  // One global task form (rows or pills) for every planner mode,
  // persisted in app-internal settings; default rows.
  const [taskForm, setTaskForm] = React.useState<TaskForm>(
    () => loadSettings().taskForm,
  );
  const changeForm = React.useCallback((form: TaskForm) => {
    setTaskForm(form);
    saveSetting("taskForm", form);
  }, []);

  // A row body press opens the task editor. The guard against a
  // drop's leftover click lives in the gesture hook.
  const openTask = React.useCallback((task: TaskItem) => {
    router.push(`/task/${encodeURIComponent(task.id)}`);
  }, []);

  const { source, cycle, choose, anchor, openMenu, closeMenu } =
    usePlannerSource();

  // The pointer machinery: drags, drops, click guards and the swipes.
  const {
    attachRoot,
    pointerHandlers,
    lifted,
    api,
    toggle,
    open,
    startDrag,
    select,
    shiftDay,
    shiftMonth,
    consumeClick,
    dropTargets,
    dragging,
    ghost,
  } = usePlannerGestures({
    day,
    setDay,
    toggle: toggleTask,
    open: openTask,
    writeFields: patchTask,
    pointerPickup,
  });

  // The month's picked day lives here, not in the pane, so it survives
  // a visit to Day or Week and back.
  const month = usePlannerMonth({ tasks, source, day });

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
      lifted,
      api,
      toggle,
      open,
      dragStart: startDrag,
    }),
    [today, source, cycle, anchor, openMenu, taskForm, changeForm, lifted, api, toggle, open, startDrag],
  );

  return (
    <View
      ref={attachRoot}
      // The strip hangs from the top edge of the safe area. Where the
      // device has no inset, as in the web preview, it keeps a step
      // clear of the screen's edge.
      style={[layout.screen, { paddingTop: Math.max(insets.top, spacing.s) }]}
      {...pointerHandlers}
    >
      <PlannerListProvider value={list}>
        {status === "ready" && mode === "day" ? (
          <DaySpread
            date={day}
            today={today}
            tasks={tasks}
            onMode={setMode}
            onSelectStrip={setDay}
            onShiftDay={shiftDay}
            drop={dropTargets}
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
                onSelect={select}
                onOpenDay={openDay}
                drop={dropTargets}
              />
            ) : null}
            {status === "ready" && mode === "month" ? (
              <MonthPane
                month={month}
                tasks={tasks}
                day={day}
                today={today}
                onShiftMonth={shiftMonth}
                onOpenDay={openDay}
                consumeClick={consumeClick}
                drop={dropTargets}
              />
            ) : null}
          </View>
        )}
      </PlannerListProvider>

      {/* The drag ghost and the source chooser draw through the overlay
          host, so both sit above the bottom bar. */}
      <DragGhost
        task={dragging}
        x={ghost.x}
        y={ghost.y}
      />
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
