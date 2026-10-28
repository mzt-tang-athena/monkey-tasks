import * as React from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CaptureTarget, TaskItem } from "@/types/task";
import { BottomBar } from "@/components/BottomBar";
import { useReduceMotion } from "@/lib/motion";
import { isoOf } from "@/utils/dates";
import { cycleSource, sourceLabel, SOURCES, type Source } from "./model";
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
import { loadSettings, saveSetting, type TaskForm } from "@/lib/settings";
import { useTaskList, useStoreMeta } from "@/store/task-state";
import { useTaskActions } from "@/store/task-actions";
import { useOpenTasks } from "@/store/selectors";
import { usePlannerRoute } from "./hooks/usePlannerRoute";
import { usePlannerGestures } from "./hooks/usePlannerGestures";
import { usePlannerMonth } from "./hooks/usePlannerMonth";

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
  const tasks = useValid(useTaskList());
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
  // The menu scales in from its corner and the backdrop fades; both
  // ride one value.
  const reduced = useReduceMotion();
  const [menuAnim] = React.useState(() => new Animated.Value(0));
  const menuOpen = sourceMenu != null;
  React.useEffect(() => {
    if (!menuOpen) {
      menuAnim.setValue(0);
      return;
    }
    if (reduced) {
      menuAnim.setValue(1);
      return;
    }
    menuAnim.setValue(0);
    Animated.timing(menuAnim, {
      toValue: 1,
      duration: 140,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [menuOpen, menuAnim, reduced]);

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

  const openTasks = useValid(useOpenTasks());

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
            <View style={styles.weekBody}>
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
            </View>
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
          <Animated.View
            style={[styles.menuBackdrop, { opacity: menuAnim }]}
          >
            <Pressable
              style={styles.menuBackdrop}
              onPress={() => setSourceMenu(null)}
              accessibilityLabel="close source menu"
              accessibilityRole="button"
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.sourceMenu,
              {
                top: sourceMenu.top,
                left: sourceMenu.left,
                opacity: menuAnim,
                // It grows out of its top left corner, next to the chip
                // that opened it.
                transformOrigin: "top left",
                transform: [
                  {
                    scale: menuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                ],
              },
            ]}
          >
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
          </Animated.View>
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
