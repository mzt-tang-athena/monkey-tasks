import * as React from "react";
import { Pressable, Text, View, type PointerEvent as RNPointerEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TaskItem } from "../tasks/query";
import type { CaptureTarget } from "../capture/write";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { BottomBar } from "../../components/BottomBar";
import { DropZoneMap } from "../../lib/dropzone";
import { addDays, parseStoredDate, startOfDay, isSameDay } from "../../lib/dates";
import { drag } from "../../theme/tokens";
import { loadTaskForm, saveTaskForm, type TaskForm } from "../../lib/task-form";
import { useTaskList, useStoreMeta } from "../../store/task-state";
import { useTaskActions } from "../../store/task-actions";
import { useOpenTasks } from "../../store/selectors";
import {
  cycleSource,
  inSourceList,
  isDone,
  isoOf,
  pillsForSource,
  sortOpenFirst,
  sourceLabel,
  startOfMonth,
  startOfWeek,
  withKeptTime,
  SOURCES,
  type Source,
} from "./model";
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
import { pointerPickup, type DragApi, type LiftState } from "./components/drag";
import { usePlannerRoute } from "./hooks/usePlannerRoute";
import { useTouchDragGate, type PendingDrag } from "./hooks/useTouchDragGate";

/*
 * Pointer modules: the drag closures below are created during render
 * but only ever run on pointer events. The react-hooks/refs and
 * react-hooks/purity rules cannot see that distinction, so they are
 * disabled for this file; every ref write outside the gesture
 * callbacks stays mirrored in effects.
 */

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
 * The pure rules behind these modes live in features/planner/model.
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
  const [taskForm, setTaskForm] = React.useState<TaskForm>(() =>
    loadTaskForm(),
  );
  const changeTaskForm = (form: TaskForm) => {
    setTaskForm(form);
    saveTaskForm(form);
  };

  // The pill/list drag that targets week columns and month cells.
  const [pending, setPending] = React.useState<PendingDrag | null>(null);
  const [dragging, setDragging] = React.useState<{
    task: TaskItem;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredDay, setHoveredDay] = React.useState<Date | null>(null);
  const moved = React.useRef(false);

  // The shared drop-zone registry: week columns and month cells
  // register their rects; pointer moves hit-test page coordinates
  // so touch drags land exactly like mouse drags.
  const [dropZones] = React.useState(() => new DropZoneMap());

  // The screen root carries the scroll gate: when a drag owns the
  // pointer, pane scrolling loses the gesture. The gate owns touch
  // promotions since touchmove outraces pointermove.
  const rootRef = React.useRef<HTMLElement | null>(null);
  const gateRef = React.useRef(false);
  const pendingRef = React.useRef(pending);
  React.useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  React.useEffect(() => {
    gateRef.current = dragging != null;
  }, [dragging]);
  const promotePending = React.useCallback((x: number, y: number) => {
    const pending = pendingRef.current;
    if (!pending || pending.task == null) {
      return;
    }
    moved.current = true;
    dropZones.measureAll();
    setDragging({ task: pending.task, x, y });
    setPending(null);
  }, [dropZones]);
  const lifted = React.useMemo<LiftState>(
    () =>
      pending != null
        ? { task: pending.task, phase: "hold" }
        : dragging != null
          ? { task: dragging.task, phase: "picked" }
          : null,
    [pending, dragging],
  );
  useTouchDragGate(rootRef, {
    busy: gateRef,
    pending: pendingRef,
    promote: promotePending,
  });

  // Native drag sources drive the same machinery through here.
  const dragApi = React.useMemo<DragApi>(() => {
    const apply = () => {
      const current = draggingRef.current;
      if (current && hoveredRef.current != null) {
        updateTaskRef.current?.(current.task, {
          due: withKeptTime(
            hoveredRef.current,
            parseStoredDate(current.task.data?.due ?? ""),
          ),
        });
      }
      // Only a pointer gesture delivers a click after the drop, so
      // only the web path arms the guard. Native taps must land.
      if (pointerPickup) {
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 350);
      }
      setDragging(null);
      setHoveredDay(null);
    };
    return {
      pickup: (task, x, y) => {
        moved.current = false;
        dropZones.measureAll();
        setDragging({ task, x, y });
      },
      move: (x, y) => {
        setDragging((current) => (current ? { ...current, x, y } : current));
        const hit = dropZones.hit(x, y);
        const dayTarget = hit?.startsWith("day:")
          ? (parseStoredDate(hit.slice(4))?.date ?? null)
          : null;
        if (!isSameDay(dayTarget, hoveredRef.current)) {
          // The ref leads the state: a drop reads it before React
          // commits the render that carries the new hover.
          hoveredRef.current = dayTarget;
          setHoveredDay(dayTarget);
        }
      },
      drop: apply,
    };
  }, [dropZones]);
  const draggingRef = React.useRef(dragging);
  const hoveredRef = React.useRef(hoveredDay);
  React.useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);
  React.useEffect(() => {
    hoveredRef.current = hoveredDay;
  }, [hoveredDay]);
  const updateTaskRef = React.useRef<
    (task: TaskItem, patch: Partial<TaskFrontmatter>) => void
  >(null);

  const storeToggle = actions.toggle;
  const toggle = React.useCallback(
    (task: TaskItem) => {
      void storeToggle(task);
    },
    [storeToggle],
  );

  // Drag-and-drop writes due dates and times through here: the store
  // applies locally, then rewrites the note in vault mode. The
  // callback keeps its identity for the store's lifetime: dayApi is
  // keyed on it, and a fresh identity every render would rebuild the
  // native pan on every move.
  const writeFields = actions.writeFields;
  const updateTask = React.useCallback(
    (task: TaskItem, patch: Partial<TaskFrontmatter>) => {
      void writeFields(task, patch);
    },
    [writeFields],
  );
  React.useEffect(() => {
    updateTaskRef.current = updateTask;
  }, [updateTask]);

  const openTasks = useOpenTasks();

  const weekPool = pillsForSource(tasks, source, startOfWeek(day));

  // The month card's picked day carries the month key it belongs to,
  // so a new month from the strip invalidates the pick without an
  // effect.
  const [picked, setPicked] = React.useState<{
    key: string;
    day: Date;
  } | null>(null);
  const viewMonth = startOfMonth(day);
  const monthKey = `${viewMonth.getFullYear()}-${viewMonth.getMonth()}`;
  const pickedDay =
    picked != null && picked.key === monthKey ? picked.day : null;

  // The month pane follows the source until a day is picked; then it
  // lists that day's tasks, with the day as its header and the
  // day-view link as its footer.
  const monthPrefix = `${viewMonth.getFullYear()}-${String(
    viewMonth.getMonth() + 1,
  ).padStart(2, "0")}`;
  const monthRows = React.useMemo(
    () =>
      source === "due-period"
        ? sortOpenFirst(
            tasks.filter(
              (task) =>
                task.data?.due != null &&
                task.data.due.slice(0, 7) === monthPrefix,
            ),
          )
        : sortOpenFirst(tasks.filter((task) => inSourceList(task, source))),
    [tasks, source, monthPrefix],
  );
  const pickedTasks = React.useMemo(
    () =>
      pickedDay == null
        ? []
        : tasks.filter(
            (task) =>
              task.data?.due != null &&
              !isDone(task) &&
              task.data.due.slice(0, 10) === isoOf(pickedDay),
          ),
    [tasks, pickedDay],
  );

  // Suppress press actions that follow a drag drop: the pointer-up
  // lands inside a pressable that would otherwise act on it.
  const suppressClick = React.useRef(false);
  const guardedToggle = (task: TaskItem) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    toggle(task);
  };
  // Week columns select a day; a drop from a dragged task must not
  // select the column it was released over.
  const guardedSelect = (next: Date) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setDay(next);
  };

  // Left/right swipe on the background shifts the day in the route.
  // DaySpread and MonthView build their swipe controllers once on
  // mount, so the shift reads the current day through a ref rather
  // than a captured render value.
  const dayRef = React.useRef(day);
  React.useEffect(() => {
    dayRef.current = day;
  }, [day]);
  const shiftDay = (delta: 1 | -1) => setDay(addDays(dayRef.current, delta));
  const shiftMonth = (delta: 1 | -1) => {
    const current = dayRef.current;
    setDay(new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const startDayDrag = (task: TaskItem, e: RNPointerEvent, kind: "pill" | "row" = "row") => {
    moved.current = false;
    setPending({
      task,
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
      t: performance.now(),
      touch: (e.nativeEvent as { pointerType?: string }).pointerType === "touch",
      kind,
    });
  };

  const onPointerMove = (e: RNPointerEvent) => {
    const x = e.nativeEvent.pageX;
    const y = e.nativeEvent.pageY;
    if (pending) {
      const travel = Math.abs(x - pending.x) + Math.abs(y - pending.y);
      if (pending.touch) {
        // Touch grammar: movement while still holding is a scroll.
        // Movement AFTER the hold completed is a drag, however far
        // it jumps between move events. Pills hold for less: their
        // section has free space to scroll from without touching
        // them.
        const hold = pending.kind === "pill" ? drag.pillPickMs : drag.pickMs;
        if (performance.now() - pending.t < hold) {
          if (travel > drag.threshold) {
            setPending(null);
            return;
          }
          return;
        }
      } else if (travel <= drag.threshold) {
        return;
      }
      moved.current = true;
      dropZones.measureAll();
      setDragging({ task: pending.task, x, y });
      setPending(null);
      return;
    }
    if (dragging) {
      setDragging({ ...dragging, x, y });
      // Hit-test the pointer against the registered drop zones:
      // enter/leave events do not fire on touch under capture.
      const hit = dropZones.hit(x, y);
      const dayTarget = hit?.startsWith("day:")
        ? parseStoredDate(hit.slice(4))?.date ?? null
        : null;
      if (!isSameDay(dayTarget, hoveredDay)) {
        setHoveredDay(dayTarget);
      }
    }
  };

  const onPointerUp = () => {
    if (dragging) {
      if (hoveredDay != null) {
        // A day move keeps the task's own time of day, per the
        // approved rule: reschedule the date, never the clock.
        updateTask(dragging.task, {
          due: withKeptTime(hoveredDay, parseStoredDate(dragging.task.data?.due ?? "")),
        });
      }
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 350);
      setDragging(null);
      setHoveredDay(null);
    }
    setPending(null);
    moved.current = false;
  };

  const onPointerDownScreen = () => {
    // A fresh gesture clears drag-end suppression; the 350ms timer
    // stays as the fallback for engines that skip pointerdown.
    suppressClick.current = false;
  };

  return (
    <View
      ref={(node) => {
        rootRef.current = node as HTMLElement | null;
      }}
      style={[styles.screen, { paddingTop: insets.top }]}
      onPointerDown={onPointerDownScreen}
      {...(pointerPickup
        ? {
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
          }
        : {})}
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
        <View
          pointerEvents="none"
          style={[styles.dragGhost, { left: dragging.x - 100, top: dragging.y - 40 }]}
        >
          <View style={styles.dragGhostChip}>
            <View style={styles.ghostBar} />
            <Text style={styles.dragGhostText} numberOfLines={1}>
              {dragging.task.name}
            </Text>
          </View>
        </View>
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

/* ----------------------------------------------------------- helpers */


function LoadingState() {
  return (
    <View style={styles.holder}>
      <View style={[styles.skeleton, { width: "60%" as const, height: 28 }]} />
      <View style={[styles.skeleton, { width: "85%" as const }]} />
      <View style={[styles.skeleton, { width: "70%" as const }]} />
    </View>
  );
}

/** The load failed. The button runs the same load again, so the
    screen never asks for a pull gesture it does not have. */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.holder}>
      <Text style={styles.empty}>Something went wrong.</Text>
      <Pressable
        style={({ pressed }) => [
          styles.retry,
          pressed && styles.retryPressed,
        ]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading tasks"
      >
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

