import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { taskIsDone, type TaskFrontmatter } from "@monkey-tasks/schemas";
import { TaskRow } from "../../components/TaskRow";
import { BottomBar } from "../../components/BottomBar";
import { makeSwipeController, swipeProps } from "../../lib/swipe";
import { DropZoneMap, touchNoScroll } from "../../lib/dropzone";
import { loadMockTasks, toggleMockCompleted } from "../../lib/mock";
import { addDays, formatLocal, parseStoredDate, startOfDay } from "../../lib/dates";
import { colors, fonts, spacing, radius, radiusFloating, radii, measure, drag, weekColWidth, weekCanvasHeight, pageGutter, periodStep } from "../../theme/tokens";
import { loadTaskForm, saveTaskForm, type TaskForm } from "../../lib/task-form";
import type { PointerEvent as RNPointerEvent } from "react-native";

/**
 * The consolidated Planner tab. Day mode is a fixed split: the
 * hour-ruler timeline on top, the dashed drop line as the divider
 * between it and the full today-list below, and a grabber on the
 * line that resizes the two panes. Tasks drag between the list and
 * the ruler; a drop writes the slot's hour onto the task. Week is
 * F's horizontal canvas of day columns; month stays a card with
 * dots and lists a day's tasks on tap.
 */
type Mode = "day" | "week" | "month";

/** Where the bottom list's tasks come from. */
type Source = "due-period" | "Focus" | "Main";
const SOURCES: Source[] = ["due-period", "Focus", "Main"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TARGETS: CaptureTarget[] = [
  { kind: "list", name: "Focus", uri: "mock://vault/Tasks/Lists/Focus.md" },
  { kind: "main" },
];

/** First and last hour shown by the ruler. */
const RULER_START = 7;
const RULER_END = 22;

export default function PlannerScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [tasks, setTasks] = React.useState<TaskItem[] | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mode, setMode] = React.useState<Mode>(() =>
    params.mode === "week" || params.mode === "month"
      ? (params.mode as Mode)
      : "day",
  );
  const [selected, setSelected] = React.useState(() => startOfDay(new Date()));

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
  const [pending, setPending] = React.useState<{
    task: TaskItem;
    x: number;
    y: number;
    /** Gesture start time and input type: touch pickups wait out
        drag.pickMs so list scrolling is never hijacked. */
    t: number;
    touch: boolean;
    /** Pills scroll from free space around them, so their hold is
        shorter than a row's. */
    kind: "pill" | "row";
  } | null>(null);
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
  // pointer, pane scrolling loses the gesture.
  const rootRef = React.useRef<HTMLElement | null>(null);
  const gateActive = React.useRef(false);
  React.useEffect(() => {
    gateActive.current = dragging != null;
  }, [dragging]);
  useTouchGate(rootRef, gateActive);

  React.useEffect(() => {
    let cancelled = false;
    loadMockTasks()
      .then((loaded) => {
        if (!cancelled) {
          setTasks(loaded);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (task: TaskItem) => {
    setTasks((current) =>
      (current ?? []).map((item) =>
        item.uri === task.uri ? toggleMockCompleted(item) : item,
      ),
    );
  };

  // Drag-and-drop writes due dates and times through here.
  const updateTask = (task: TaskItem, patch: Partial<TaskFrontmatter>) => {
    setTasks((current) =>
      (current ?? []).map((item) =>
        item.uri === task.uri
          ? { ...item, data: { ...(item.data as TaskFrontmatter), ...patch } }
          : item,
      ),
    );
  };

  const all = tasks ?? [];
  const groups = groupByDue(all, new Date());
  const open = [...groups.overdue, ...groups.today, ...groups.undated];
  for (const bucket of groups.upcoming) {
    open.push(...bucket.items);
  }

  const weekPool = pillsForSource(all, source, startOfWeek(selected));

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
  const guardedSelect = (day: Date) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setSelected(day);
  };

  // Left/right swipe on the background shifts the selected day, so
  // the callback never reads render state.
  const shiftDay = React.useCallback(
    (delta: 1 | -1) => setSelected((current) => addDays(current, delta)),
    [],
  );
  const shiftMonth = React.useCallback(
    (delta: 1 | -1) =>
      setSelected(
        (current) =>
          new Date(current.getFullYear(), current.getMonth() + delta, 1),
      ),
    [],
  );

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
        // Touch: movement before the hold means the user is
        // scrolling. Cancel the pending pickup and let the browser
        // own the gesture. Pills get a shorter hold: their section
        // has free space to scroll from without touching them.
        if (travel > drag.threshold) {
          setPending(null);
          return;
        }
        const hold = pending.kind === "pill" ? drag.pillPickMs : drag.pickMs;
        if (performance.now() - pending.t < hold) {
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
      style={styles.screen}
      onPointerDown={onPointerDownScreen}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {status === "ready" && mode === "day" ? (
        // Day mode leaves the page scroll: it is a fixed split of
        // timeline and list, sized by the grabber between them.
        <DaySpread
          date={selected}
          today={new Date()}
          tasks={all}
          openTasks={open}
          source={source}
          onCycleSource={cycleSource(source, setSource)}
          onOpenSourceMenu={setSourceMenu}
          sourceMenuOpen={sourceMenu != null}
          taskForm={taskForm}
          onFormChange={changeTaskForm}
          onMode={setMode}
          onSelectStrip={setSelected}
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
            selected={selected}
            today={new Date()}
            onSelect={setSelected}
            onMode={setMode}
          />

          {status === "loading" ? <LoadingState /> : null}
          {status === "error" ? (
            <EmptyState label="Something went wrong. Pull to retry." />
          ) : null}

          {status === "ready" && mode === "week" ? (
            <>
              <WeekView
                tasks={open}
                today={new Date()}
                selected={selected}
                onSelect={guardedSelect}
                onDragTask={startDayDrag}
                dragActive={dragging != null}
                hoveredDay={hoveredDay}
                dropZones={dropZones}
              />
              {/* Week's foot: the shared section in its own scrolling
                  pane, fed the week's placement pool. */}
              <View style={styles.paneList}>
                <ScrollView
                  style={styles.paneScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <TaskListSection
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
                    emptyLabel={
                      source === "due-period"
                        ? "Nothing to place this week."
                        : `Nothing on ${source} yet.`
                    }
                  />
                </ScrollView>
              </View>
            </>
          ) : null}
          {status === "ready" && mode === "month" ? (
            <MonthView
              viewMonth={startOfMonth(selected)}
              today={new Date()}
              tasks={all}
              source={source}
              onCycleSource={cycleSource(source, setSource)}
              onOpenSourceMenu={setSourceMenu}
              sourceMenuOpen={sourceMenu != null}
              taskForm={taskForm}
              onFormChange={changeTaskForm}
              onToggle={guardedToggle}
              onOpenDay={(day) => {
                setSelected(day);
                setMode("day");
              }}
              onShiftMonth={shiftMonth}
              pressGuard={suppressClick}
              dropZones={dropZones}
              dragActive={dragging != null}
              hoveredDay={hoveredDay}
              onDragTask={startDayDrag}
            />
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

      {/* One bottom bar: nav left, capture button right. */}
      <BottomBar
        targets={TARGETS}
        defaultTargetIndex={1}
        onSend={() => undefined}
      />
    </View>
  );
}

/** The source cycle: due period, then each named list, then back. */
function cycleSource(
  source: Source,
  setSource: (next: Source) => void,
): () => void {
  return () => {
    const index = SOURCES.indexOf(source);
    setSource(SOURCES[(index + 1) % SOURCES.length]);
  };
}

function sourceLabel(source: Source, mode: Mode): string {
  if (source === "due-period") {
    return mode === "day"
      ? "Due today"
      : mode === "week"
        ? "Due this week"
        : "Due this month";
  }
  return source;
}

/**
 * Week foot pills: every open task of the chosen source, dated or
 * not - dragging moves a date, it never removes membership.
 */
function pillsForSource(
  tasks: TaskItem[],
  source: Source,
  weekStart: Date,
): TaskItem[] {
  const startIso = isoOf(weekStart);
  const endIso = isoOf(addDays(weekStart, 6));
  const open = tasks.filter((task) => !isDone(task));
  if (source === "due-period") {
    return sortOpenFirst(
      open.filter(
        (task) =>
          task.data?.due == null ||
          (task.data.due.slice(0, 10) >= startIso &&
            task.data.due.slice(0, 10) <= endIso),
      ),
    );
  }
  return sortOpenFirst(open.filter((task) => inSourceList(task, source)));
}

function inSourceList(task: TaskItem, list: string): boolean {
  if (list === "Main") {
    return task.data == null || !task.data.lists?.length;
  }
  return task.data?.lists?.includes(`[[${list}]]`) ?? false;
}

/** A task is done exactly per the contracts rule. */
function isDone(task: TaskItem): boolean {
  return task.data == null ? false : taskIsDone(task.data);
}

/* ------------------------------------------------------------- strips */

/** Whole-day index between two epoch times, DST-proof. */
function dayIndexBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / 86400000);
}

/**
 * The lazy-follow rule for the period rails. A rail sits anchored to
 * today; when the selected period walks off its end, the rail slides
 * just enough that the selection lands on the edge cell: last when
 * moving forward, first when moving backward.
 */
function railStartIdx(anchorIdx: number, selIdx: number, count: number): number {
  if (selIdx > anchorIdx + count - 1) {
    return selIdx - (count - 1);
  }
  if (selIdx < anchorIdx) {
    return selIdx;
  }
  return anchorIdx;
}

/** Open tasks first, by due time, then completed ones behind them.
    Decorate-time parse: sorting re-parses nothing per comparison. */
function sortOpenFirst(items: TaskItem[]): TaskItem[] {
  const stamp = (task: TaskItem): number =>
    task.data?.due ? (parseStoredDate(task.data.due)?.date.getTime() ?? 0) : 0;
  const stamped = items.map((task) => ({ task, time: stamp(task) }));
  const byTime = (a: { task: TaskItem; time: number }, b: { task: TaskItem; time: number }) =>
    a.time - b.time || a.task.name.localeCompare(b.task.name);
  return [
    ...stamped
      .filter((entry) => !isDone(entry.task))
      .sort(byTime)
      .map((entry) => entry.task),
    ...stamped
      .filter((entry) => isDone(entry.task))
      .sort(byTime)
      .map((entry) => entry.task),
  ];
}

/* ------------------------------------------------------------- header */

/** The shared top block: period strip and the mode pills. */
function PlannerHeader({
  mode,
  selected,
  today,
  onSelect,
  onMode,
}: {
  mode: Mode;
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
  onMode: (mode: Mode) => void;
}) {
  return (
    <View>
      {/* Period strip above the pills: days, weeks, or months to
          match the mode. Tapping a period jumps to it. */}
      <PeriodStrip
        mode={mode}
        selected={selected}
        today={today}
        onSelect={onSelect}
      />

      {/* E's economy: the toggle pills lead the header block. */}
      <View style={styles.segmented}>
        {(["day", "week", "month"] as Mode[]).map((option, index) => (
          <Pressable
            key={option}
            style={({ pressed }) => [
              styles.segment,
              mode === option && styles.segmentActive,
              pressed && styles.pressedFill,
              // Square corners on the selected segment's open sides.
              mode === option &&
                (index === 0
                  ? styles.segmentFirst
                  : index === 2
                    ? styles.segmentLast
                    : styles.segmentMiddle),
            ]}
            onPress={() => onMode(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === option }}
          >
            <Text
              style={[
                styles.segmentText,
                mode === option && styles.segmentTextActive,
              ]}
            >
              {option === "day" ? "Day" : option === "week" ? "Week" : "Month"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ---------------------------------------------------------------- day */

/**
 * The small source toggle above a mode's bottom list. Quiet at rest:
 * a muted label and a chevron. Pressed, it previews the next source
 * in the cycle. Held past drag.holdMs, it opens the direct chooser
 * menu (rendered by the screen) instead of cycling.
 */
function SourceToggle({
  source,
  mode,
  menuOpen,
  onCycle,
  onOpenMenu,
}: {
  source: Source;
  mode: Mode;
  menuOpen: boolean;
  onCycle: () => void;
  onOpenMenu: (anchor: { top: number; left: number }) => void;
}) {
  const wrapRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hover, setHover] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [held, setHeld] = React.useState(false);

  const index = SOURCES.indexOf(source);
  const label = sourceLabel(source, mode);
  const nextLabel = sourceLabel(SOURCES[(index + 1) % SOURCES.length], mode);

  React.useEffect(
    () => () => {
      if (holdTimer.current != null) {
        clearTimeout(holdTimer.current);
      }
    },
    [],
  );

  return (
    <View ref={wrapRef}>
      <Pressable
        style={({ pressed }) => [
          styles.sourceToggle,
          (hover || pressed) && styles.sourceToggleHot,
        ]}        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        onPressIn={() => {
          setPressed(true);
          setHeld(false);
          holdTimer.current = setTimeout(() => {
            setHeld(true);
            wrapRef.current?.measureInWindow((x, y, width, height) => {
              onOpenMenu({
                top: y + height + 4,
                left: Math.max(x, spacing.m),
              });
            });
          }, drag.holdMs);
        }}
        onPressOut={() => {
          setPressed(false);
          if (holdTimer.current != null) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
          }
        }}
        // Tap cycles; a press that opened the chooser must not.
        onPress={() => {
          if (held || menuOpen) {
            return;
          }
          onCycle();
        }}
        accessibilityRole="button"
        accessibilityLabel={`task source: ${label}`}
      >
        <Text
          style={[
            styles.sourceToggleText,
            pressed && !held && styles.sourceToggleTextHot,
          ]}
        >
          {pressed && !held ? nextLabel : label}
        </Text>
        <Text style={styles.sourceToggleChevron}>{"▾"}</Text>
      </Pressable>
    </View>
  );
}

/** Round-1 tray pills, back as draggable chips: drag-first, no tick. */
function TaskPills({
  tasks,
  onDragStart,
}: {
  tasks: TaskItem[];
  onDragStart: (task: TaskItem, e: RNPointerEvent, kind?: "pill" | "row") => void;
}) {
  if (tasks.length === 0) {
    return null;
  }
  return (
    <View style={styles.pillsWrap}>
      {tasks.map((task) => (
        <View
          key={task.uri}
          style={styles.pillChip}
          onPointerDown={(e) => onDragStart(task, e, "pill")}
        >
          <View style={styles.pillGrip}>
            <View style={styles.pillGripDot} />
            <View style={styles.pillGripDot} />
          </View>
          {/* A placed pill carries its date; dragging moves it. */}
          {task.data?.due != null ? (
            <Text style={styles.pillDate}>{pillDateLabel(task)}</Text>
          ) : null}
          <Text style={styles.pillText} numberOfLines={1}>
            {task.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function pillDateLabel(task: TaskItem): string {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  if (!due) {
    return "";
  }
  return `${MONTHS_SHORT[due.date.getMonth()]} ${due.date.getDate()}`;
}

/**
 * The tiny segmented form toggle at the bottom half's right edge:
 * rows (ticked list) or pills (drag-first chips). Presentation only;
 * the data is the same either way.
 */
function FormToggle({
  form,
  onChange,
}: {
  form: TaskForm;
  onChange: (form: TaskForm) => void;
}) {
  return (
    <View style={styles.formToggle}>
      {(
        [
          { key: "rows", label: "list form" },
          { key: "pills", label: "pill form" },
        ] as const
      ).map((segment, index) => (
        <Pressable
          key={segment.key}
          style={({ pressed }) => [
            styles.formSegment,
            form === segment.key && styles.formSegmentActive,
            pressed && form !== segment.key && styles.formSegmentPressed,
            form === segment.key &&
              (index === 0 ? styles.segmentFirst : styles.segmentLast),
          ]}
          onPress={() => onChange(segment.key)}
          accessibilityRole="tab"
          accessibilityLabel={segment.label}
          accessibilityState={{ selected: form === segment.key }}
        >
          {segment.key === "rows" ? (
            <View style={styles.formGlyphRows}>
              <View
                style={[
                  styles.formGlyphBar,
                  form === segment.key && styles.formGlyphBarActive,
                ]}
              />
              <View
                style={[
                  styles.formGlyphBar,
                  styles.formGlyphBarShort,
                  form === segment.key && styles.formGlyphBarActive,
                ]}
              />
              <View
                style={[
                  styles.formGlyphBar,
                  form === segment.key && styles.formGlyphBarActive,
                ]}
              />
            </View>
          ) : (
            <View
              style={[
                styles.formGlyphPill,
                form === segment.key && styles.formGlyphPillActive,
              ]}
            />
          )}
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The shared bottom-half task section: the source control on the
 * left, the small form toggle on the right, then the section's
 * tasks as rows or pills - the same data both ways. Day and Month
 * render this; Week renders it with its placement pool. An optional
 * header block carries a group header (overdue, tapped day) and an
 * optional footer carries the month's open-in-day-view link.
 */
function TaskListSection({
  source,
  mode,
  sourceMenuOpen,
  onCycleSource,
  onOpenSourceMenu,
  taskForm,
  onFormChange,
  onToggle,
  onDragStart,
  tasks,
  emptyLabel,
  header,
  footer,
}: {
  source: Source;
  mode: Mode;
  sourceMenuOpen: boolean;
  onCycleSource: () => void;
  onOpenSourceMenu: (anchor: { top: number; left: number }) => void;
  taskForm: TaskForm;
  onFormChange: (form: TaskForm) => void;
  onToggle: (task: TaskItem) => void;
  onDragStart: (task: TaskItem, e: RNPointerEvent) => void;
  tasks: TaskItem[];
  emptyLabel: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View>
      <View style={styles.sectionHead}>
        <SourceToggle
          source={source}
          mode={mode}
          menuOpen={sourceMenuOpen}
          onCycle={onCycleSource}
          onOpenMenu={onOpenSourceMenu}
        />
        <View style={styles.sectionSpacer} />
        <FormToggle form={taskForm} onChange={onFormChange} />
      </View>
      {header}
      {taskForm === "rows" ? (
        tasks.length > 0 ? (
          tasks.map((task, index) => (
            <View
              key={task.uri}
              style={index > 0 ? styles.groupRow : undefined}
              onPointerDown={(e) => onDragStart(task, e)}
            >
              <TaskRow task={task} onToggle={onToggle} />
            </View>
          ))
        ) : (
          <Text style={styles.empty}>{emptyLabel}</Text>
        )
      ) : (
        <>
          <TaskPills tasks={tasks} onDragStart={onDragStart} />
          {tasks.length === 0 ? (
            <Text style={styles.empty}>{emptyLabel}</Text>
          ) : null}
        </>
      )}
      {footer}
    </View>
  );
}

function DaySpread({
  date,
  today,
  tasks,
  openTasks,
  source,
  onCycleSource,
  onOpenSourceMenu,
  sourceMenuOpen,
  taskForm,
  onFormChange,
  onMode,
  onSelectStrip,
  onShiftDay,
  onToggle,
  onUpdate,
}: {
  date: Date;
  today: Date;
  tasks: TaskItem[];
  openTasks: TaskItem[];
  source: Source;
  onCycleSource: () => void;
  onOpenSourceMenu: (anchor: { top: number; left: number }) => void;
  sourceMenuOpen: boolean;
  taskForm: TaskForm;
  onFormChange: (form: TaskForm) => void;
  onMode: (mode: Mode) => void;
  onSelectStrip: (date: Date) => void;
  /** Swipe left/right on the background shifts one day. */
  onShiftDay: (delta: 1 | -1) => void;
  onToggle: (task: TaskItem) => void;
  onUpdate: (task: TaskItem, patch: Partial<TaskFrontmatter>) => void;
}) {
  const [rootHeight, setRootHeight] = React.useState(0);
  const [rootX, setRootX] = React.useState(0);
  // The pane's top edge inside the root, measured at layout: the
  // divider may never travel past it plus a minimum list pane.
  const [paneTop, setPaneTop] = React.useState(200);
  const [timelineHeight, setTimelineHeight] = React.useState(320);
  // A press waiting to travel: promoted to a drag past the threshold.
  const [pending, setPending] = React.useState<{
    task: TaskItem;
    x: number;
    y: number;
    t: number;
    touch: boolean;
  } | null>(null);
  const [dragging, setDragging] = React.useState<{
    task: TaskItem;
    x: number;
    y: number;
  } | null>(null);
  const [hoverHour, setHoverHour] = React.useState<number | null>(null);
  const [resizing, setResizing] = React.useState<{
    y: number;
    height: number;
  } | null>(null);
  const [grabHot, setGrabHot] = React.useState(false);
  const moved = React.useRef(false);
  const suppressClick = React.useRef(false);

  // The day swipe: armed only from a touch that did NOT start on a
  // task row or the grabber. Rows set taskTouched on their own
  // pointerdown, and the root's pointerdown reads it right after,
  // so a drag start claims the whole gesture. Created once; the
  // shift callback is a stable functional updater.
  const taskTouched = React.useRef(false);
  const [swipe] = React.useState(() =>
    makeSwipeController((dir) => onShiftDay(dir === "left" ? 1 : -1)),
  );
  const dividerHeight = 28;
  // Ruler rows register under their hour; moves hit-test these
  // rects, since touch capture suppresses enter/leave events.
  const [hourZones] = React.useState(() => new DropZoneMap());

  // DaySpread also gates scrolling while a drag or the grabber owns
  // the pointer, so the split resize survives on touch.
  const dayRootRef = React.useRef<HTMLElement | null>(null);
  const dayGate = React.useRef(false);
  React.useEffect(() => {
    dayGate.current = dragging != null || resizing != null;
  }, [dragging, resizing]);
  useTouchGate(dayRootRef, dayGate);

  const sameDay = startOfDay(today).getTime() === startOfDay(date).getTime();
  const groups = groupByDue(tasks, today);
  const overdue = sameDay ? groups.overdue : [];
  // All of the day's tasks, completed ones struck and kept visible
  // until the day rolls.
  const dayTasks = sameDay
    ? sortOpenFirst(
        tasks.filter(
          (task) =>
            task.data?.due != null && task.data.due.slice(0, 10) === isoOf(date),
        ),
      )
    : sortOpenFirst(tasksForDayAll(tasks, date));
  const timed = dayTasks.filter(hasTime);

  // The list pane's rows follow the chosen source. In the pills form
  // the overdue group folds into the pool, so the data set is the
  // same both ways.
  const listRows =
    source === "due-period"
      ? dayTasks
      : sortOpenFirst(tasks.filter((task) => inSourceList(task, source)));
  const sectionTasks =
    taskForm === "pills" && source === "due-period"
      ? sortOpenFirst([...overdue, ...listRows])
      : listRows;

  // The divider's travel limit: the timeline may grow until the
  // list pane keeps its minimum, with the top block's height and
  // the bottom bar's zone respected - so the grabber can never
  // slide under the navbar where a finger could not reach it.
  const barZone = 96;
  const maxTimeline = Math.max(
    rootHeight - paneTop - dividerHeight - drag.minPane - barZone,
    drag.minPane,
  );

  const startTaskDrag = (task: TaskItem, e: RNPointerEvent) => {
    moved.current = false;
    // Claim the gesture against the day swipe, synchronously, before
    // the root's pointerdown reads the flag.
    taskTouched.current = true;
    setPending({
      task,
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
      t: performance.now(),
      touch: (e.nativeEvent as { pointerType?: string }).pointerType === "touch",
    });
  };

  // A drag that ends back on its source must not also toggle it.
  const guardedToggle = (task: TaskItem) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onToggle(task);
  };

  const onPointerMove = (e: RNPointerEvent) => {
    const x = e.nativeEvent.pageX;
    const y = e.nativeEvent.pageY;
    swipe.move(x, y);
    if (resizing) {
      const grown = resizing.height + (y - resizing.y);
      setTimelineHeight(
        Math.min(Math.max(grown, drag.minPane), Math.max(maxTimeline, drag.minPane)),
      );
      return;
    }
    if (pending) {
      const travel = Math.abs(x - pending.x) + Math.abs(y - pending.y);
      if (pending.touch) {
        if (travel > drag.threshold) {
          setPending(null);
          return;
        }
        if (performance.now() - pending.t < drag.pickMs) {
          return;
        }
      } else if (travel <= drag.threshold) {
        return;
      }
      moved.current = true;
      hourZones.measureAll();
      setDragging({ task: pending.task, x, y });
      setPending(null);
      return;
    }
    if (dragging) {
      setDragging({ ...dragging, x, y });
      const hit = hourZones.hit(x, y);
      const hour = hit?.startsWith("hour:") ? Number(hit.slice(5)) : null;
      if (hour !== hoverHour) {
        setHoverHour(hour);
      }
    }
  };

  const onPointerUp = () => {
    swipe.up();
    if (resizing) {
      setResizing(null);
      return;
    }
    if (dragging) {
      if (hoverHour != null) {
        // The slot's hour with the task's own minute: an hour drop
        // never rounds away what the task already carries.
        onUpdate(dragging.task, {
          due: withTime(date, hoverHour, minuteOf(dragging.task)),
        });
      }
      // Swallow the click that follows a drop onto the source row.
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 350);
      setDragging(null);
      setHoverHour(null);
    }
    setPending(null);
    moved.current = false;
  };

  return (
    <View
      ref={(node) => {
        dayRootRef.current = node as HTMLElement | null;
      }}
      style={styles.dayRoot}
      onLayout={(e) => {
        setRootHeight(e.nativeEvent.layout.height);
        setRootX(e.nativeEvent.layout.x);
      }}
      onPointerDown={(e) => {
        // A fresh gesture clears drag-end suppression, like the
        // screen root does for its own drops.
        suppressClick.current = false;
        swipe.down(
          e.nativeEvent.pageX,
          e.nativeEvent.pageY,
          taskTouched.current,
        );
        taskTouched.current = false;
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <PlannerHeader
        mode="day"
        selected={date}
        today={today}
        onSelect={onSelectStrip}
        onMode={onMode}
      />

      {/* Compact day heading: eyebrow, short serif date, accent rule. */}
      <Text style={styles.dateMonth}>
        {MONTHS[date.getMonth()]} {date.getFullYear()}
      </Text>
      <Text style={styles.dateHeader}>
        {WEEKDAYS_FULL[date.getDay()]} {date.getDate()}
      </Text>
      <View style={styles.dateRule} />

      {/* The timeline pane: the ruler, resizable by the grabber. */}
      <View
        style={[styles.pane, { height: timelineHeight }]}
        onLayout={(e) => {
          setPaneTop(e.nativeEvent.layout.y);
        }}
      >
        <Text style={styles.sectionLabel}>Timeline  {timed.length}</Text>
        <ScrollView
          style={styles.paneScroll}
          showsVerticalScrollIndicator={false}
        >
          <Timeline
            tasks={timed}
            isToday={sameDay}
            now={today}
            dragActive={dragging != null}
            hoverHour={hoverHour}
            zones={hourZones}
            onToggle={guardedToggle}
            onDragStart={startTaskDrag}
          />
        </ScrollView>
      </View>

      {/* The dashed drop line IS the divider: quiet until a drag
          starts. The grabber on it resizes the split. */}
      <View style={styles.divider}>
        <View
          style={[
            styles.dividerLine,
            (dragging != null || resizing != null) && styles.dividerActive,
          ]}
        />
        <Pressable
          style={({ pressed }) => [
            styles.grabberHit,
            touchNoScroll,
            (grabHot || pressed) && styles.grabberHitHot,
          ]}
          onHoverIn={() => setGrabHot(true)}
          onHoverOut={() => setGrabHot(false)}
          onPointerDown={(e) => {
            // The grabber claims the gesture too: resizing must
            // never fire a day swipe.
            taskTouched.current = true;
            setResizing({
              y: e.nativeEvent.pageY,
              height: timelineHeight,
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="resize timeline"
        >
          <View
            style={[
              styles.grabberBar,
              (grabHot || resizing != null || dragging != null) &&
                styles.grabberBarActive,
            ]}
          />
        </Pressable>
      </View>

      {/* The task list pane: the shared bottom-half section. Its
          source picks the rows; dragging a row up into the ruler
          sets its time. */}
      <View style={styles.paneList}>
        <ScrollView
          style={styles.paneScroll}
          showsVerticalScrollIndicator={false}
        >
          <TaskListSection
            source={source}
            mode="day"
            sourceMenuOpen={sourceMenuOpen}
            onCycleSource={onCycleSource}
            onOpenSourceMenu={onOpenSourceMenu}
            taskForm={taskForm}
            onFormChange={onFormChange}
            onToggle={guardedToggle}
            onDragStart={startTaskDrag}
            tasks={sectionTasks}
            emptyLabel={
              source === "due-period"
                ? "Nothing scheduled today."
                : `Nothing on ${source} yet.`
            }
            header={
              taskForm === "rows" && source === "due-period" &&
              overdue.length > 0 ? (
                <View style={styles.overdueBlock}>
                  <Text style={styles.overdueLabel}>
                    Overdue  {overdue.length}
                  </Text>
                  {overdue.map((task) => (
                    <View
                      key={task.uri}
                      onPointerDown={(e) => startTaskDrag(task, e)}
                    >
                      <TaskRow task={task} onToggle={guardedToggle} />
                    </View>
                  ))}
                </View>
              ) : undefined
            }
          />
        </ScrollView>
      </View>

      {/* The drag ghost, riding just above the pointer. */}
      {dragging ? (
        <View
          pointerEvents="none"
          style={[styles.dragGhost, { left: dragging.x - rootX - 100, top: dragging.y - 40 }]}
        >
          <View style={styles.dragGhostChip}>
            <View style={styles.ghostBar} />
            <Text style={styles.dragGhostText} numberOfLines={1}>
              {dragging.task.name}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The hour ruler: hour marks down the left, tasks pinned between. */
function Timeline({
  tasks,
  isToday,
  now,
  dragActive,
  hoverHour,
  zones,
  onToggle,
  onDragStart,
}: {
  tasks: TaskItem[];
  isToday: boolean;
  now: Date;
  dragActive: boolean;
  hoverHour: number | null;
  /** Rows register under their hour; moves hit-test these rects. */
  zones: DropZoneMap;
  onToggle: (task: TaskItem) => void;
  onDragStart: (task: TaskItem, e: RNPointerEvent) => void;
}) {
  const hours: TaskItem[][] = [];
  for (let h = RULER_START; h <= RULER_END; h++) {
    hours[h] = [];
  }
  for (const task of tasks) {
    const hour = hourOf(task);
    if (hour === null) {
      continue;
    }
    const slot = Math.min(Math.max(hour, RULER_START), RULER_END);
    hours[slot].push(task);
  }

  return (
    <View style={styles.ruler}>
      {hours.map((slotTasks, hour) => {
        const children: React.ReactNode[] = [];
        let placedNow = false;
        for (const task of slotTasks) {
          if (
            isToday &&
            hour === now.getHours() &&
            minuteOf(task) > now.getMinutes() &&
            !placedNow
          ) {
            children.push(<NowLine key="now" />);
            placedNow = true;
          }
          children.push(
            <HourTask
              key={task.uri}
              task={task}
              onToggle={onToggle}
              onDragStart={onDragStart}
            />,
          );
        }
        if (isToday && hour === now.getHours() && !placedNow) {
          children.push(<NowLine key="now" />);
        }
        return (
          <View
            key={hour}
            ref={(node) => {
              zones.set(`hour:${hour}`, node);
            }}
            style={[
              styles.rulerRow,
              dragActive && hoverHour === hour && styles.rulerRowHover,
            ]}
          >
            <Text style={styles.rulerMark}>{labelHour(hour)}</Text>
            <View style={styles.rulerSlot}>{children}</View>
          </View>
        );
      })}
    </View>
  );
}

function HourTask({
  task,
  onToggle,
  onDragStart,
}: {
  task: TaskItem;
  onToggle: (task: TaskItem) => void;
  onDragStart: (task: TaskItem, e: RNPointerEvent) => void;
}) {
  const [hover, setHover] = React.useState(false);
  const done = isDone(task);
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  // The chip body is selection only (no-op for now); its circle is
  // the done toggle. Done tasks stay in their slot, struck.
  return (
    <View
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onPointerDown={(e) => onDragStart(task, e)}
      style={[styles.hourTask, hover && styles.hourTaskHover]}
    >
      <View style={[styles.taskBar, done && styles.taskBarDone]} />
      <Pressable
        style={[styles.tickCircle, done && styles.tickCircleDone]}
        onPress={() => onToggle(task)}
        accessibilityLabel={done ? "mark not done" : "mark done"}
        accessibilityRole="button"
      >
        {done ? <Text style={styles.tickCheck}>{"✓"}</Text> : null}
      </Pressable>
      <View style={styles.taskBody}>
        <Text style={[styles.taskName, done && styles.taskNameDone]} numberOfLines={2}>
          {task.name}
        </Text>
        {due?.hasTime ? (
          <Text style={[styles.taskTime, done && styles.taskTimeDone]}>
            {formatTime(due.date)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function NowLine() {
  return (
    <View style={styles.nowLineRow}>
      <View style={styles.nowDot} />
      <View style={styles.nowLine} />
    </View>
  );
}

/* --------------------------------------------------------------- week */

/** F's week body: day columns with real content, one swipe away. */
function WeekView({
  tasks,
  today,
  selected,
  onSelect,
  onDragTask,
  dragActive,
  hoveredDay,
  dropZones,
}: {
  tasks: TaskItem[];
  today: Date;
  selected: Date;
  onSelect: (date: Date) => void;
  /** Week day cards drag between columns, like the pool rows do. */
  onDragTask: (task: TaskItem, e: RNPointerEvent) => void;
  dragActive: boolean;
  hoveredDay: Date | null;
  /** The columns register here; moves hit-test instead of relying
      on enter/leave events, which touch never delivers. */
  dropZones: DropZoneMap;
}) {
  const todayStart = startOfDay(today).getTime();
  // The strip picks the week; its seven columns start on Sunday.
  const weekStart = startOfWeek(selected);
  const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(weekStart, offset));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.weekScroller}
      contentContainerStyle={styles.weekCanvas}
    >
      {days.map((day) => {
        const items = tasksForDay(tasks, day);
        const isToday = startOfDay(day).getTime() === todayStart;
        const isSelected =
          startOfDay(day).getTime() === startOfDay(selected).getTime();
        const isHovered = dragActive && isSameDay(day, hoveredDay);
        return (
          <Pressable
            key={day.getTime()}
            style={({ pressed }) => [
              styles.weekCol,
              isSelected && !isToday && styles.weekColSelected,
              isToday && styles.weekColToday,
              isHovered && styles.weekColHovered,
              pressed && styles.pressedFill,
            ]}
            ref={(node) => {
              dropZones.set(`day:${isoOf(day)}`, node);
            }}
            onPress={() => onSelect(day)}
            accessibilityRole="button"
            accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
          >
            <Text style={styles.weekDayName}>
              {isToday ? "Today" : WEEKDAYS[day.getDay()]}
            </Text>
            <Text
              style={[styles.weekDayNum, isToday && styles.weekDayNumToday]}
            >
              {day.getDate()}
            </Text>
            <View style={styles.weekColRule} />
            {items.length > 0 ? (
              items.map((task) => (
                <View
                  key={task.uri}
                  style={styles.weekTask}
                  onPointerDown={(e) => onDragTask(task, e)}
                >
                  <View style={styles.taskBar} />
                  <Text style={styles.weekTaskText} numberOfLines={3}>
                    {hasTime(task) ? `${timeOf(task)}  ` : ""}
                    {task.name}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.weekFree}>free</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* -------------------------------------------------------------- month */

/** D/F month: the grid in a card; the list below follows the source. */
function MonthView({
  viewMonth,
  today,
  tasks,
  source,
  onCycleSource,
  onOpenSourceMenu,
  sourceMenuOpen,
  taskForm,
  onFormChange,
  onToggle,
  onOpenDay,
  onShiftMonth,
  pressGuard,
  dropZones,
  dragActive,
  hoveredDay,
  onDragTask,
}: {
  viewMonth: Date;
  today: Date;
  tasks: TaskItem[];
  source: Source;
  onCycleSource: () => void;
  onOpenSourceMenu: (anchor: { top: number; left: number }) => void;
  sourceMenuOpen: boolean;
  taskForm: TaskForm;
  onFormChange: (form: TaskForm) => void;
  onToggle: (task: TaskItem) => void;
  onOpenDay: (day: Date) => void;
  /** Swipe left/right on the fixed calendar shifts a whole month. */
  onShiftMonth: (delta: 1 | -1) => void;
  /** Drag drops that land on a cell suppress that cell's pick. */
  pressGuard?: { current: boolean };
  /** Cells register here for move-based hit testing. */
  dropZones: DropZoneMap;
  dragActive: boolean;
  hoveredDay: Date | null;
  onDragTask: (task: TaskItem, e: RNPointerEvent) => void;
}) {
  // The picked day carries the month key it belongs to, so a new
  // month from the strip invalidates the tapped-day panel without
  // an effect.
  const [picked, setPicked] = React.useState<{
    key: string;
    day: Date;
  } | null>(null);
  const year = viewMonth.getFullYear();
  const monthIdx = viewMonth.getMonth();
  const monthKey = `${year}-${monthIdx}`;
  const monthStart = new Date(year, monthIdx, 1);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const lead = monthStart.getDay();

  const byDay = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    if (task.data?.due == null || isDone(task)) {
      continue;
    }    const iso = task.data.due.slice(0, 10);
    const bucket = byDay.get(iso);
    if (bucket) {
      bucket.push(task);
    } else {
      byDay.set(iso, [task]);
    }
  }
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(year, monthIdx, index + 1),
    ),
  ];

  // The list under the card follows the source; open tasks first,
  // completed ones struck behind.
  const monthPrefix = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
  const listRows =
    source === "due-period"
      ? sortOpenFirst(
          tasks.filter(
            (task) =>
              task.data?.due != null &&
              task.data.due.slice(0, 7) === monthPrefix,
          ),
        )
      : sortOpenFirst(tasks.filter((task) => inSourceList(task, source)));
  const pickedTasks =
    picked && picked.key === monthKey
      ? (byDay.get(isoOf(picked.day)) ?? [])
      : null;

  // Swipe left/right on the fixed calendar areas shifts one month.
  // Created once; the shift callback is a stable functional updater.
  const [calendarSwipe] = React.useState(() =>
    makeSwipeController((dir) => onShiftMonth(dir === "left" ? 1 : -1)),
  );

  return (
    <View style={styles.monthColumn}>
      <View style={styles.monthFixed} {...swipeProps(calendarSwipe)}>
        <Text style={styles.monthTitle}>
          {MONTHS[monthIdx]} {year}
        </Text>
        <View style={styles.monthCard}>
        <View style={styles.monthHead}>
          {WEEKDAYS.map((name) => (
            <Text key={name} style={styles.monthHeadCell}>
              {name[0]}
            </Text>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {cells.map((day, index) =>
            day == null ? (
              <View key={`blank-${index}`} style={styles.monthCell} />
            ) : (
              <Pressable
                key={day.getTime()}
                style={({ pressed }) => [
                  styles.monthCell,
                  isSameDay(day, picked?.day ?? null) &&
                  styles.monthCellPicked,
                  isSameDay(day, today) && styles.monthCellToday,
                  dragActive &&
                    isSameDay(day, hoveredDay) && styles.monthCellHovered,
                  pressed && styles.pressedFill,
                ]}
                onPress={() => {
                  // A drag drop that released over this cell
                  // suppresses the accidental pick.
                  if (pressGuard?.current) {
                    pressGuard.current = false;
                    return;
                  }
                  setPicked({ key: monthKey, day });
                }}
                ref={(node) => {
                  dropZones.set(`day:${isoOf(day)}`, node);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
              >
                <Text
                  style={[
                    styles.monthNum,
                    isSameDay(day, today) && styles.monthNumToday,
                  ]}
                >
                  {day.getDate()}
                </Text>
                {/* The dot slot is always reserved, so every number
                    sits on one baseline with or without a dot. */}
                <View style={styles.monthDotSlot}>
                  {byDay.has(isoOf(day)) ? <View style={styles.monthDot} /> : null}
                </View>
              </Pressable>
            ),
          )}
        </View>
        </View>
      </View>

      {/* The list beneath the card: the shared bottom-half section in
          its own scrolling pane. Its rows drag onto a day cell above
          to move their due date. The tapped day stays a group header;
          the month keeps its open-in-day-view link. */}
      <View style={styles.monthDayPanel}>
        <ScrollView
          style={styles.paneScroll}
          showsVerticalScrollIndicator={false}
        >
        <TaskListSection
          source={source}
          mode="month"
          sourceMenuOpen={sourceMenuOpen}
          onCycleSource={onCycleSource}
          onOpenSourceMenu={onOpenSourceMenu}
          taskForm={taskForm}
          onFormChange={onFormChange}
          onToggle={onToggle}
          onDragStart={onDragTask}
          tasks={listRows}
          emptyLabel={
            source === "due-period"
              ? "Nothing scheduled this month."
              : `Nothing on ${source} yet.`
          }
          header={
            pickedTasks ? (
              <View style={styles.monthPickedBlock}>
                <Text style={styles.sectionLabel}>
                  {WEEKDAYS_FULL[picked!.day.getDay()]} {picked!.day.getDate()}
                  {"  "}
                  {pickedTasks.length}
                </Text>
                {pickedTasks.length > 0 ? (
                  pickedTasks.map((task) => (
                    <View
                      key={task.uri}
                      onPointerDown={(e) => onDragTask(task, e)}
                    >
                      <TaskRow task={task} onToggle={onToggle} />
                    </View>
                  ))
                ) : (
                  <Text style={styles.monthDayEmpty}>Nothing scheduled.</Text>
                )}
              </View>
            ) : undefined
          }
          footer={
            pickedTasks ? (
              <Pressable
                style={({ pressed }) => [
                  styles.monthDayOpen,
                  pressed && styles.detailsPressed,
                ]}
                onPress={() => onOpenDay(picked!.day)}
                accessibilityRole="button"
                accessibilityLabel="open this day"
              >
                <Text style={styles.monthDayOpenText}>Open in day view</Text>
              </Pressable>
            ) : undefined
          }
        />
        </ScrollView>
      </View>
    </View>
  );
}

/* ----------------------------------------------------------- helpers */

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * One horizontally scrolling period rail (weeks or months). It
 * auto-scrolls only when the active cell leaves the viewport, so
 * ordinary use never moves the rail without the user asking.
 */
function PeriodRail({
  count,
  activeIdx,
  renderItem,
}: {
  count: number;
  activeIdx: number;
  renderItem: (index: number) => React.ReactNode;
}) {
  // stripDay 44 + one gap 8: the rail's cell step. The token keeps
  // the alignment math honest when a pill tune lands.
  const STEP = periodStep;
  const scroller = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const viewport = React.useRef(0);
  const railX = React.useRef(0);

  // Align only when the active cell sits outside the viewport: the
  // rail never moves on its own otherwise. Cells live at
  // pageGutter + i * STEP inside the padded rail content, so both
  // the boundary test and the targets carry the gutter offset.
  const alignToActive = React.useCallback(() => {
    if (viewport.current <= 0) {
      return;
    }
    const lo = Math.floor((railX.current - pageGutter) / STEP);
    const hi = Math.floor((railX.current - pageGutter + viewport.current) / STEP);
    if (activeIdx < lo) {
      const x = pageGutter + activeIdx * STEP;
      railX.current = x;
      scroller.current?.scrollTo({ x, animated: false });
    } else if (activeIdx > hi - 1) {
      const x = Math.max(pageGutter + (activeIdx + 1) * STEP - viewport.current, 0);
      railX.current = x;
      scroller.current?.scrollTo({ x, animated: false });
    }
  }, [activeIdx]);

  // Mount: week and month share this component, and several browser
  // engines carry a stale horizontal offset into a remounted scroller.
  // Start clean at the anchor, then align if the cell is already off.
  // Mount: week and month share this component, and several browser
  // engines carry a stale horizontal offset into a remounted scroller.
  // Start clean at the anchor, then align if the cell is already off.
  React.useLayoutEffect(() => {
    scroller.current?.scrollTo({ x: 0, animated: false });
    railX.current = 0;
  }, []);
  React.useLayoutEffect(alignToActive, [activeIdx, alignToActive, STEP]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.railBleed}
      contentContainerStyle={styles.stripScroll}
      onLayout={(e) => {
        viewport.current = e.nativeEvent.layout.width;
        // First real measurement may already need an alignment.
        alignToActive();
      }}
      onScroll={(e) => {
        railX.current = e.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={64}
    >
      {Array.from({ length: count }, (_, index) => renderItem(index))}
    </ScrollView>
  );
}

/**
 * The period strip above the pills. Day mode shows the seven days
 * containing the selected day; week and month show a scrolling rail.
 * The current period is tinted, the selected period is filled, and a
 * tap jumps to it. Selection drifts make the rails follow lazily.
 */
function PeriodStrip({
  mode,
  selected,
  today,
  onSelect,
}: {
  mode: Mode;
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
}) {
  const todayStart = startOfDay(today).getTime();
  const selStart = startOfDay(selected).getTime();

  if (mode === "day") {
    // The 7-day window containing the selected day: today-first
    // while the selection stays inside today's block, then the rail
    // walks one day per step off either edge.
    const selIdx = dayIndexBetween(todayStart, selStart);
    const startIdx = railStartIdx(0, selIdx, 7);
    const days = [0, 1, 2, 3, 4, 5, 6].map((offset) =>
      addDays(today, startIdx + offset),
    );
    return (
      <View style={styles.strip}>
        {days.map((day) => {
          const active = isSameDay(day, selected);
          const isToday = startOfDay(day).getTime() === todayStart;
          return (
            <Pressable
              key={day.getTime()}
              style={({ pressed }) => [
                styles.stripDay,
                active && styles.stripDayActive,
                isToday && !active && styles.stripDayToday,
                pressed && styles.pressedFill,
              ]}
              onPress={() => onSelect(day)}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
            >
              <Text
                style={[
                  styles.stripName,
                  active && styles.stripNameActive,
                  isToday && !active && styles.stripNameToday,
                ]}
              >
                {WEEKDAYS[day.getDay()]}
              </Text>
              <Text
                style={[
                  styles.stripNum,
                  active && styles.stripNumActive,
                  isToday && !active && styles.stripNumToday,
                ]}
              >
                {day.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (mode === "week") {
    // One week per cell, current week first, rail rebasing per the
    // lazy-follow rule when the selected week walks off its end.
    const selWeekIdx = Math.round(
      (startOfWeek(selected).getTime() - startOfWeek(today).getTime()) /
        (7 * 86400000),
    );
    const startIdx = railStartIdx(0, selWeekIdx, 12);
    const railBase = startOfWeek(today);
    return (
      <PeriodRail
        key="week"
        count={12}
        activeIdx={selWeekIdx - startIdx}
        renderItem={(index) => {
          const weekStartDay = addDays(railBase, 7 * (startIdx + index));
          const weekEnd = addDays(weekStartDay, 6);
          const startT = weekStartDay.getTime();
          const endT = weekEnd.getTime();
          const active = selStart >= startT && selStart <= endT;
          const isCurrent = todayStart >= startT && todayStart <= endT;
          return (
            <Pressable
              key={startT}
              style={({ pressed }) => [
                styles.stripDay,
                active && styles.stripDayActive,
                isCurrent && !active && styles.stripDayToday,
                pressed && styles.pressedFill,
              ]}
              onPress={() => onSelect(weekStartDay)}
              accessibilityRole="button"
              accessibilityLabel={`week of ${MONTHS_SHORT[weekStartDay.getMonth()]} ${weekStartDay.getDate()}-${weekEnd.getDate()}`}
            >
              <Text
                style={[
                  styles.stripName,
                  active && styles.stripNameActive,
                  isCurrent && !active && styles.stripNameToday,
                ]}
              >
                {`${weekStartDay.getDate()}-${weekEnd.getDate()}`}
              </Text>
              <Text
                style={[
                  styles.stripNum,
                  active && styles.stripNumActive,
                  isCurrent && !active && styles.stripNumToday,
                ]}
              >
                {`W${isoWeek(addDays(weekStartDay, 3))}`}
              </Text>
            </Pressable>
          );
        }}
      />
    );
  }

  // Month mode: a rail of 12 months, current month first, rebasing
  // per the lazy-follow rule. Cells mirror the day strip's anatomy:
  // the year small on top, the month word below it.
  const selMonthIdx =
    selected.getFullYear() * 12 + selected.getMonth();
  const todayMonthIdx = today.getFullYear() * 12 + today.getMonth();
  // Indexes are relative to today's month, so the rebase rule never
  // sees calendar-sized offsets.
  const selRelMonthIdx = selMonthIdx - todayMonthIdx;
  const startIdx = railStartIdx(0, selRelMonthIdx, 12);
  const railYear = today.getFullYear();
  const railMonth = today.getMonth() + startIdx;
  return (
    <PeriodRail
      key="month"
      count={12}
      activeIdx={selRelMonthIdx - startIdx}
      renderItem={(index) => {
        const monthStartDay = new Date(railYear, railMonth + index, 1);
        const active =
          selected.getFullYear() === monthStartDay.getFullYear() &&
          selected.getMonth() === monthStartDay.getMonth();
        const isCurrent =
          today.getFullYear() === monthStartDay.getFullYear() &&
          today.getMonth() === monthStartDay.getMonth();
        return (
          <Pressable
            key={monthStartDay.getTime()}
            style={({ pressed }) => [
              styles.stripDay,
              active && styles.stripDayActive,
              isCurrent && !active && styles.stripDayToday,
              pressed && styles.pressedFill,
            ]}
            onPress={() => onSelect(monthStartDay)}
            accessibilityRole="button"
            accessibilityLabel={`${MONTHS[monthStartDay.getMonth()]} ${monthStartDay.getFullYear()}`}
          >
            <Text
              style={[
                styles.stripName,
                active && styles.stripNameActive,
                isCurrent && !active && styles.stripNameToday,
              ]}
            >
              {monthStartDay.getFullYear()}
            </Text>
            <Text
              style={[
                styles.stripNum,
                active && styles.stripNumActive,
                isCurrent && !active && styles.stripNumToday,
              ]}
            >
              {MONTHS_SHORT[monthStartDay.getMonth()]}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

function tasksForDay(tasks: TaskItem[], day: Date): TaskItem[] {
  const iso = isoOf(day);
  return tasks.filter(
    (task) =>
      task.data?.due != null &&
      task.data.due.slice(0, 10) === iso &&
      !(task.data != null && isDone(task)),
  );
}

/** Every task touching the day, completed ones included. */
function tasksForDayAll(tasks: TaskItem[], day: Date): TaskItem[] {
  const iso = isoOf(day);
  return tasks.filter(
    (task) => task.data?.due != null && task.data.due.slice(0, 10) === iso,
  );
}

function hasTime(task: TaskItem): boolean {
  return task.data?.due
    ? (parseStoredDate(task.data.due)?.hasTime ?? false)
    : false;
}

function timeOf(task: TaskItem): string {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  if (!due) {
    return "";
  }
  return formatTime(due.date);
}

function hourOf(task: TaskItem): number | null {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  return due?.hasTime ? due.date.getHours() : null;
}

function minuteOf(task: TaskItem): number {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  return due?.date.getMinutes() ?? 0;
}

/**
 * The due string a timeline drop writes: the shown day at the
 * slot's hour, keeping the task's own minute.
 */
function withTime(
  day: Date,
  hour: number,
  minute = 0,
): string {
  return formatLocal(
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute),
    true,
  );
}

/**
 * The due string an all-day move writes: the target day with the
 * task's previous time of day when it had one.
 */
function withKeptTime(
  day: Date,
  previous: { date: Date; hasTime: boolean } | null,
): string {
  if (!previous?.hasTime) {
    return formatLocal(day, false);
  }
  return formatLocal(
    new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      previous.date.getHours(),
      previous.date.getMinutes(),
    ),
    true,
  );
}

function labelHour(hour: number): string {
  const h = hour % 12 || 12;
  return `${h} ${hour >= 12 ? "PM" : "AM"}`;
}

/**
 * While a drag or grab owns the pointer, the browser must keep its
 * hands off the pane scrolling: touch-action is read once at the
 * gesture's start and cannot change, but a non-passive touchmove
 * listener is read per event, so preventDefault wins mid-gesture.
 * Mounts once per drag root; the ref flips as gestures come alive.
 */
function useTouchGate(
  ref: React.RefObject<HTMLElement | null>,
  active: React.RefObject<boolean>,
) {
  React.useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const onMove = (e: TouchEvent) => {
      if (active.current) {
        e.preventDefault();
      }
    };
    node.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      node.removeEventListener("touchmove", onMove);
    };
  }, [ref, active]);
}

function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${h}:${String(date.getMinutes()).padStart(2, "0")} ${ampm}`;
}

function isoOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (a == null || b == null) {
    return false;
  }
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Sunday of the week holding date. */
function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

/** The first of the month holding date. */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The ISO week number of the week holding date. */
function isoWeek(date: Date): number {
  const probe = startOfDay(date);
  probe.setDate(probe.getDate() + 3 - ((probe.getDay() + 6) % 7));
  const firstThu = new Date(probe.getFullYear(), 0, 4);
  firstThu.setDate(firstThu.getDate() - ((firstThu.getDay() + 6) % 7));
  return (
    1 +
    Math.round((probe.getTime() - firstThu.getTime()) / (7 * 86400000))
  );
}

function LoadingState() {
  return (
    <View style={styles.holder}>
      <View style={[styles.skeleton, { width: "60%" as const, height: 28 }]} />
      <View style={[styles.skeleton, { width: "85%" as const }]} />
      <View style={[styles.skeleton, { width: "70%" as const }]} />
    </View>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.holder}>
      <Text style={styles.empty}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    // Drags must not start native text selection in the web preview.
    userSelect: "none" as const,
  },
  // week and month: the fixed frame. Header and calendar sit still;
  // only the bottom pane scrolls.
  frame: {
    flex: 1,
    width: "100%" as const,
    maxWidth: measure,
    alignSelf: "center" as const,
    paddingHorizontal: pageGutter,
    // No top padding: the selected strip tab hangs from the screen's
    // top edge, and the content below gains the space.
  },
  pressedFill: {
    backgroundColor: colors.pressed,
  },

  // period strip: day cells, then the wider week and month cells
  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing.s,
  },
  stripScroll: {
    flexDirection: "row",
    gap: spacing.s,
    alignItems: "flex-end",
    // The same bottom spacing the day strip has, so the wide strips
    // never touch the pills. Page grid inside, screen-edge bleed
    // outside: the rail cuts at the display, not the gutter.
    marginBottom: spacing.s,
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
  },
  stripDay: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: radius,
  },
  stripDayActive: {
    // The selected tab hangs from the screen's top edge: square top,
    // rounded bottom, standing taller than its resting neighbours.
    height: 52,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: colors.accent,
  },
  stripDayToday: {
    backgroundColor: colors.accentSoft,
  },
  stripName: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    letterSpacing: 0.5,
  },
  stripNameActive: {
    color: colors.onAccent,
  },
  stripNameToday: {
    color: colors.accent,
    fontWeight: "600",
  },
  stripNum: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
    marginTop: 2,
  },
  stripNumActive: {
    color: colors.onAccent,
    fontWeight: "600",
  },
  stripNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },

  // shared bottom-half section: source left, form toggle right
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.s,
  },
  sectionSpacer: {
    flex: 1,
  },
  formToggle: {
    flexDirection: "row",
    gap: 2,
    padding: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius,
    backgroundColor: colors.surface,
  },
  formSegment: {
    width: 32,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius - 2,
  },
  formSegmentActive: {
    backgroundColor: colors.accent,
  },
  formSegmentPressed: {
    backgroundColor: colors.pressed,
  },
  // Square corners on a selected segment's open sides; the closed
  // sides keep the shared radius.
  segmentFirst: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  segmentMiddle: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  segmentLast: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  formGlyphRows: {
    alignItems: "flex-start",
    gap: 3,
  },
  formGlyphBar: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.inkMuted,
  },
  formGlyphBarShort: {
    width: 9,
  },
  formGlyphBarActive: {
    backgroundColor: colors.onAccent,
  },
  formGlyphPill: {
    width: 16,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: colors.inkMuted,
  },
  formGlyphPillActive: {
    borderColor: colors.onAccent,
  },
  monthDotSlot: {
    height: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  // segmented toggle, E's tighter spacing
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 3,
    marginBottom: spacing.m,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  segmentTextActive: {
    color: colors.onAccent,
    fontWeight: "600",
  },

  // compact day heading
  dateMonth: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  dateHeader: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  dateRule: {
    height: 2,
    backgroundColor: colors.accent,
    width: 40,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
    borderRadius: 1,
  },
  overdueBlock: {
    marginBottom: spacing.l,
  },
  overdueLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: spacing.s,
  },
  groupRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },

  // hour ruler
  ruler: {},
  rulerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rulerRowHover: {
    backgroundColor: colors.accentSoft,
  },
  rulerMark: {
    width: 56,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
    paddingTop: spacing.xs,
  },
  rulerSlot: {
    flex: 1,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  hourTask: {
    flexDirection: "row",
    // Optical centering: the circle, the accent bar, and the text
    // share one center line within the chip.
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.s,
    gap: spacing.s,
  },
  hourTaskPressed: {
    backgroundColor: colors.pressed,
  },
  taskBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
    minHeight: 20,
  },
  taskBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  taskName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  taskTime: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
  },
  nowLineRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 18,
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
    marginRight: spacing.xs,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.danger,
    borderRadius: 1,
  },

  // day split: fixed header over two panes, sized by the grabber
  dayRoot: {
    flex: 1,
    width: "100%" as const,
    maxWidth: measure,
    alignSelf: "center" as const,
    paddingHorizontal: pageGutter,
    // No top padding: the selected strip tab hangs from the screen's
    // top edge, and the content below gains the space.
  },
  pane: {},
  paneList: {
    flex: 1,
  },
  paneScroll: {
    flex: 1,
  },
  divider: {
    height: 28,
    justifyContent: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  dividerLine: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: 13,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.hairline,
  },
  dividerActive: {
    borderTopColor: colors.accent,
  },
  grabberHit: {
    alignSelf: "center" as const,
    width: 72,
    height: 28,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: radius,
  },
  grabberHitHot: {
    backgroundColor: colors.pressed,
  },
  grabberBar: {
    width: 44,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.inkFaint,
  },
  grabberBarActive: {
    backgroundColor: colors.accent,
  },
  dragGhost: {
    position: "absolute" as const,
    width: 200,
    zIndex: 20,
  },
  dragGhostChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    backgroundColor: colors.accent,
    borderRadius: radiusFloating,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ghostBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.onAccent,
    minHeight: 20,
  },
  dragGhostText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.onAccent,
    fontWeight: "600",
  },

  // The source toggle: the label slot reserves the widest source's
  // width, so the control never resizes mid-press - the pressed
  // preview must not move the box out from under the pointer.
  sourceToggle: {
    flexDirection: "row",
    alignItems: "center" as const,
    alignSelf: "flex-start" as const,
    gap: spacing.xs,
    minHeight: 32,
    paddingLeft: spacing.s,
    paddingRight: spacing.s,
    borderRadius: radius,
  },
  sourceToggleHot: {
    backgroundColor: colors.pressed,
  },
  sourceToggleText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "600",
    minWidth: 96,
  },
  sourceToggleTextHot: {
    color: colors.accent,
  },
  sourceToggleChevron: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.inkFaint,
  },
  menuBackdrop: {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  sourceMenu: {
    position: "absolute" as const,
    width: 200,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radiusFloating,
    paddingVertical: spacing.xs,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center" as const,
    minHeight: 40,
    paddingHorizontal: spacing.m,
  },
  menuItemPressed: {
    backgroundColor: colors.pressed,
  },
  menuItemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  menuItemCheck: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent,
    fontWeight: "700",
  },

  // week foot pills row
  pillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s,
  },
  pillChip: {
    flexDirection: "row",
    alignItems: "center" as const,
    gap: spacing.s,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.pill,
    paddingLeft: spacing.m,
    paddingRight: spacing.m,
    paddingVertical: spacing.s,
    maxWidth: "100%" as const,
  },
  pillGrip: {
    alignItems: "center" as const,
    gap: 2,
  },
  pillGripDot: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.inkFaint,
  },
  pillText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  pillDate: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },

  // week and month drop targets during a pill drag
  weekColHovered: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  monthCellHovered: {
    backgroundColor: colors.accentSoft,
  },
  monthPickedBlock: {
    marginBottom: spacing.s,
  },

  // timeline task chip: its own circle is the done toggle
  hourTaskHover: {
    backgroundColor: colors.pressed,
  },
  taskBarDone: {
    backgroundColor: colors.inkFaint,
  },
  tickCircle: {
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.inkFaint,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  tickCircleDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tickCheck: {
    color: colors.onAccent,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "600",
  },
  taskNameDone: {
    color: colors.inkFaint,
    textDecorationLine: "line-through",
  },
  taskTimeDone: {
    color: colors.inkFaint,
  },

  // The period rail bleeds past the page gutter: cells cut at the
  // display's edges, scrolling until the last one clears the grid.
  railBleed: {
    marginHorizontal: -pageGutter,
  },
  // week canvas: horizontally scrolling day columns. The scroller
  // bleeds to the screen's edges: columns cut at the display, not
  // the page gutter, and scroll till the last one clears it.
  // week canvas: horizontally scrolling day columns. The scroller
  // bleeds to the screen's edges: columns cut at the display, not
  // the page gutter, and scroll till the last one clears it. The
  // bounded height keeps tall viewports from stretching the columns
  // into the bottom section's space.
  weekScroller: {
    flexGrow: 0,
    flexShrink: 0,
    height: weekCanvasHeight,
    marginHorizontal: -pageGutter,
  },
  weekCanvas: {
    flexDirection: "row",
    gap: spacing.s,
    paddingVertical: spacing.xs,
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    marginBottom: spacing.xl,
  },
  weekCol: {
    width: weekColWidth,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius,
    padding: spacing.s,
    minHeight: 240,
  },
  weekColSelected: {
    borderColor: colors.accent,
  },
  weekColToday: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  weekDayName: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekDayNum: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  weekDayNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  weekColRule: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.s,
  },
  weekTask: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.paper,
    borderRadius: radius,
    padding: spacing.xs,
    marginBottom: spacing.xs,
  },
  weekTaskText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  weekFree: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    textAlign: "center",
  },

  // month view
  monthColumn: {
    flex: 1,
  },
  // The fixed half: title and grid card. Its own swipe zone shifts
  // months without touching the row drags beneath.
  monthFixed: {
    flexShrink: 0,
  },
  monthTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: spacing.s,
  },
  monthCard: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.m,
    marginBottom: spacing.m,
  },
  monthHead: {
    flexDirection: "row",
  },
  monthHeadCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "600",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  monthCell: {
    width: "14.28%" as const,
    aspectRatio: 1.1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: radius,
  },
  monthCellPicked: {
    backgroundColor: colors.accentSoft,
  },
  monthCellToday: {
    backgroundColor: colors.accentSoft,
  },
  monthNum: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  monthNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  monthDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  monthDayPanel: {
    flex: 1,
    minHeight: drag.minPane,
  },
  monthDayEmpty: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    paddingVertical: spacing.m,
  },
  monthDayOpen: {
    alignSelf: "flex-start" as const,
    marginTop: spacing.s,
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.m,
    borderRadius: radius,
  },
  monthDayOpenText: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
  detailsPressed: {
    backgroundColor: colors.pressed,
  },

  // states
  holder: {
    minHeight: 160,
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  skeleton: {
    height: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.hairline,
    marginVertical: spacing.m,
  },
  empty: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
