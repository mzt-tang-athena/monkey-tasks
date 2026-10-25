import * as React from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TaskItem } from "../tasks/query";
import type { CaptureTarget } from "../capture/write";
import { BottomBar } from "../../components/BottomBar";
import { isoOf, cycleSource, sourceLabel, SOURCES, type Source } from "./model";
import { styles } from "./components/plannerStyles";
import { DaySpread } from "./components/DaySpread";
import { WeekView } from "./components/WeekView";
import {
  MonthView,
  MonthDayHeader,
  MonthOpenDayButton,
} from "./components/MonthView";
import { PlannerHeader } from "./components/PlannerHeader";
import { TaskListSection } from "./components/TaskListSection";
import { LoadingState, ErrorState } from "./components/PlannerStates";
import { pointerPickup } from "./components/drag";
import { loadSettings, saveSetting, type TaskForm } from "../../lib/settings";
import { useTaskList, useStoreMeta } from "../../store/task-state";
import { useTaskActions } from "../../store/task-actions";
import { useOpenTasks } from "../../store/selectors";
import { usePlannerRoute } from "./hooks/usePlannerRoute";
import { usePlannerGestures } from "./hooks/usePlannerGestures";
import { usePlannerMonth } from "./hooks/usePlannerMonth";

const TARGETS: CaptureTarget[] = [
  { kind: "list", name: "Focus" },
  { kind: "main" },
];

/**
 * The consolidated Planner tab. Day mode is a fixed split: the
 * hour-ruler timeline on top, the dashed drop line as the divider
 * between it and the full today-list below, and a grabber on the
 * line that resizes the two panes. Tasks drag between the list and
 * the ruler; a drop writes the slot's hour onto the task. Week is
 * F's horizontal canvas of day columns; month stays a card with
 * dots and lists a day's tasks on tap.
 *
 * The pure rules behind these modes live in features/planner/model;
 * the gestures in hooks/usePlannerGestures and the month state in
 * hooks/usePlannerMonth.
 */
export default function PlannerScreen() {
  // The mode and the day live in the URL: a link, a tap on another
  // screen, or a remount all read the same route state back.
  const { mode, day, setMode, setDay, openDay } = usePlannerRoute();
  const tasks = useTaskList();
  const { status } = useStoreMeta();
  const actions = useTaskActions();
  const insets = useSafeAreaInsets();

  // The task source for the bottom list, shared by all three modes:
  // the due period by default, or a named list.
  const [source, setSource] = React.useState<Source>("due-period");
  const [sourceMenu, setSourceMenu] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  // One global task form (rows or pills) for every planner mode,
  // persisted in app-internal settings; default rows.
  const [taskForm, setTaskForm] = React.useState<TaskForm>(
    () => loadSettings().taskForm,
  );
  const changeTaskForm = (form: TaskForm) => {
    setTaskForm(form);
    saveSetting("taskForm", form);
  };

  // A row body press opens the task editor. The guard against a
  // drop's leftover click lives in the gesture hook.
  const openTask = React.useCallback((task: TaskItem) => {
    router.push(`/task/${encodeURIComponent(task.id)}`);
  }, []);

  // The pointer machinery: drags, drops, click guards and the swipes.
  const {
    rootRef,
    dragging,
    ghostX,
    ghostY,
    hoveredDay,
    dropZones,
    lifted,
    dragApi,
    toggle,
    updateTask,
    guardedToggle,
    guardedOpen,
    guardedSelect,
    suppressClick,
    shiftDay,
    shiftMonth,
    startDayDrag,
    pointerHandlers,
  } = usePlannerGestures({
    day,
    setDay,
    toggle: actions.toggle,
    open: openTask,
    writeFields: actions.writeFields,
    pointerPickup,
  });

  const openTasks = useOpenTasks();

  // The week's placement pool and the month card's state.
  const {
    weekPool,
    picked,
    setPicked,
    viewMonth,
    monthKey,
    pickedDay,
    monthRows,
    pickedTasks,
  } = usePlannerMonth({ tasks, source, day });

  return (
    <View
      ref={(node) => {
        rootRef.current = node as HTMLElement | null;
      }}
      style={[styles.screen, { paddingTop: insets.top }]}
      {...pointerHandlers}
    >
      {status === "ready" && mode === "day" ? (
        // Day mode leaves the page scroll: it is a fixed split of
        // timeline and list, sized by the grabber between them.
        <DaySpread
          date={day}
          today={new Date()}
          tasks={tasks}
          openTasks={openTasks}
          source={source}
          onCycleSource={cycleSource(source, setSource)}
          onOpenSourceMenu={setSourceMenu}
          sourceMenuOpen={sourceMenu != null}
          taskForm={taskForm}
          onFormChange={changeTaskForm}
          onMode={setMode}
          onSelectStrip={setDay}
          onShiftDay={shiftDay}
          onToggle={toggle}
          onOpen={guardedOpen}
          onUpdate={updateTask}
        />
      ) : (
        // Week and month: a fixed frame. The header strip and the
        // calendar sit still; ONLY the bottom task section scrolls,
        // inside its own pane - like the day split above.
        <View style={styles.frame}>
          <PlannerHeader
            mode={mode}
            selected={day}
            today={new Date()}
            onSelect={setDay}
            onMode={setMode}
          />

          {status === "loading" ? <LoadingState /> : null}
          {status === "error" ? (
            <ErrorState onRetry={() => void actions.refresh()} />
          ) : null}

          {status === "ready" && mode === "week" ? (
            <>
              <WeekView
                tasks={openTasks}
                today={new Date()}
                selected={day}
                onSelect={guardedSelect}
                onDragTask={startDayDrag}
                dragActive={dragging != null}
                hoveredDay={hoveredDay}
                dropZones={dropZones}
                lifted={lifted}
                api={dragApi}
              />
              {/* Week's foot: the shared section in its own scrolling
                  pane, fed the week's placement pool. */}
              <View style={styles.paneList}>
                <TaskListSection
                  style={styles.paneScroll}
                  source={source}
                  mode={mode}
                  sourceMenuOpen={sourceMenu != null}
                  onCycleSource={cycleSource(source, setSource)}
                  onOpenSourceMenu={setSourceMenu}
                  taskForm={taskForm}
                  onFormChange={changeTaskForm}
                  onToggle={guardedToggle}
                  onOpen={guardedOpen}
                  onDragStart={startDayDrag}
                  tasks={weekPool}
                  lifted={lifted}
                  api={dragApi}
                  emptyLabel={
                    source === "due-period"
                      ? "Nothing to place this week."
                      : `Nothing on ${source} yet.`
                  }
                />
              </View>
            </>
          ) : null}
          {status === "ready" && mode === "month" ? (
            <MonthView
              viewMonth={viewMonth}
              today={new Date()}
              tasks={tasks}
              picked={picked}
              onPick={(next) => setPicked({ key: monthKey, day: next })}
              onShiftMonth={shiftMonth}
              pressGuard={suppressClick}
              dropZones={dropZones}
              dragActive={dragging != null}
              hoveredDay={hoveredDay}
            >
              {/* The pane under the card: the source's month list
                  until a day is picked, then that day's tasks with
                  its header and the day-view link. */}
              <TaskListSection
                style={styles.paneScroll}
                source={source}
                mode="month"
                sourceMenuOpen={sourceMenu != null}
                onCycleSource={cycleSource(source, setSource)}
                onOpenSourceMenu={setSourceMenu}
                taskForm={taskForm}
                onFormChange={changeTaskForm}
                onToggle={guardedToggle}
                onOpen={guardedOpen}
                onDragStart={startDayDrag}
                tasks={pickedDay == null ? monthRows : pickedTasks}
                lifted={lifted}
                api={dragApi}
                header={
                  pickedDay == null ? undefined : (
                    <MonthDayHeader day={pickedDay} tasks={pickedTasks} />
                  )
                }
                footer={
                  pickedDay == null ? undefined : (
                    <MonthOpenDayButton onPress={() => openDay(pickedDay)} />
                  )
                }
                emptyLabel={
                  pickedDay == null
                    ? source === "due-period"
                      ? "Nothing scheduled this month."
                      : `Nothing on ${source} yet.`
                    : "Nothing scheduled."
                }
              />
            </MonthView>
          ) : null}
        </View>
      )}

      {/* The drag ghost for week and month drops. */}
      {dragging ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dragGhost,
            {
              left: 0,
              top: 0,
              transform: [{ translateX: ghostX }, { translateY: ghostY }],
            },
          ]}
        >
          <View style={styles.dragGhostChip}>
            <View style={styles.ghostBar} />
            <Text style={styles.dragGhostText} numberOfLines={1}>
              {dragging.task.name}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {/* The source chooser, opened by press-and-hold. */}
      {sourceMenu ? (
        <React.Fragment>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setSourceMenu(null)}
            accessibilityLabel="close source menu"
            accessibilityRole="button"
          />
          <View style={[styles.sourceMenu, { top: sourceMenu.top, left: sourceMenu.left }]}>
            {SOURCES.map((option) => (
              <Pressable
                key={option}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={() => {
                  setSource(option);
                  setSourceMenu(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={sourceLabel(option, mode)}
              >
                <Text style={styles.menuItemText}>
                  {sourceLabel(option, mode)}
                </Text>
                {option === source ? (
                  <Text style={styles.menuItemCheck}>{"✓"}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </React.Fragment>
      ) : null}

      {/* One bottom bar: nav left, capture button right. The planner
          preselects the viewed day as the default due date. */}
      <BottomBar
        targets={TARGETS}
        defaultTargetIndex={1}
        onSend={(parsed, target) =>
          actions.capture(parsed, target, isoOf(day))
        }
      />
    </View>
  );
}
