import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { TaskRow } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { BottomBar } from "../../components/BottomBar";
import { loadMockTasks, toggleMockCompleted } from "../../lib/mock";
import { addDays, formatLocal, parseStoredDate, startOfDay } from "../../lib/dates";
import { colors, fonts, spacing, radius, radiusFloating, radii, measure, drag } from "../../theme/tokens";
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
  const [tasks, setTasks] = React.useState<TaskItem[] | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mode, setMode] = React.useState<Mode>("day");
  const [selected, setSelected] = React.useState(() => startOfDay(new Date()));
  const [draft, setDraft] = React.useState<{
    text: string;
    targetIndex: number;
  } | null>(null);

  // The task source for the bottom list, shared by all three modes:
  // the due period by default, or a named list.
  const [source, setSource] = React.useState<Source>("due-period");
  const [sourceMenu, setSourceMenu] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  // The pill/list drag that targets week columns and month cells.
  const [pending, setPending] = React.useState<{
    task: TaskItem;
    x: number;
    y: number;
  } | null>(null);
  const [dragging, setDragging] = React.useState<{
    task: TaskItem;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredDay, setHoveredDay] = React.useState<Date | null>(null);
  const moved = React.useRef(false);

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

  const startDayDrag = (task: TaskItem, e: RNPointerEvent) => {
    moved.current = false;
    setPending({ task, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
  };

  const onPointerMove = (e: RNPointerEvent) => {
    const x = e.nativeEvent.pageX;
    const y = e.nativeEvent.pageY;
    if (pending) {
      const travel = Math.abs(x - pending.x) + Math.abs(y - pending.y);
      if (travel > drag.threshold) {
        moved.current = true;
        setDragging({ task: pending.task, x, y });
        setPending(null);
      }
      return;
    }
    if (dragging) {
      setDragging({ ...dragging, x, y });
    }
  };

  const onPointerUp = () => {
    if (dragging) {
      if (hoveredDay != null) {
        updateTask(dragging.task, { due: formatLocal(hoveredDay, false) });
      }
      setDragging(null);
      setHoveredDay(null);
    }
    setPending(null);
    moved.current = false;
  };

  return (
    <View
      style={styles.screen}
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
          onMode={setMode}
          onSelectStrip={setSelected}
          onToggle={toggle}
          onUpdate={updateTask}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <PlannerHeader
            mode={mode}
            selected={selected}
            today={new Date()}
            tasks={open}
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
                onSelect={setSelected}
                dragActive={dragging != null}
                hoveredDay={hoveredDay}
                onHoverDay={setHoveredDay}
              />
              {/* Week's foot: draggable pill chips, filtered by the
                  chosen source. */}
              <View style={styles.pillsSection}>
                <SourceToggle
                  source={source}
                  mode={mode}
                  onCycle={cycleSource(source, setSource)}
                  onOpenMenu={setSourceMenu}
                  menuOpen={sourceMenu != null}
                />
                <UnscheduledPills
                  tasks={undatedForSource(all, source)}
                  onDragStart={startDayDrag}
                />
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
              onToggle={toggle}
              onOpenDay={(day) => {
                setSelected(day);
                setMode("day");
              }}
              dragActive={dragging != null}
              hoveredDay={hoveredDay}
              onHoverDay={setHoveredDay}
              onDragTask={startDayDrag}
            />
          ) : null}
        </ScrollView>
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
        onOpenDetails={(text, targetIndex) =>
          setDraft(text.trim() ? { text, targetIndex } : null)
        }
      />
      {draft ? (
        <CaptureSheet
          visible
          targets={TARGETS}
          defaultTargetIndex={draft.targetIndex}
          initialText={draft.text}
          preselectedDue={isoOf(selected)}
          onClose={() => setDraft(null)}
          onSend={() => setDraft(null)}
        />
      ) : null}
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

/** Undated tasks, filtered to the chosen source. */
function undatedForSource(tasks: TaskItem[], source: Source): TaskItem[] {
  const undated = tasks.filter(
    (task) => task.data?.due == null && !isDone(task),
  );
  return source === "due-period"
    ? undated
    : undated.filter((task) => inSourceList(task, source));
}

function inSourceList(task: TaskItem, list: string): boolean {
  if (list === "Main") {
    return task.data == null || !task.data.lists?.length;
  }
  return task.data?.lists?.includes(`[[${list}]]`) ?? false;
}

function isDone(task: TaskItem): boolean {
  return task.data?.completed != null && task.data.completed !== "";
}

/** Open tasks first, by due time, then completed ones behind them. */
function sortOpenFirst(items: TaskItem[]): TaskItem[] {
  const timeValue = (task: TaskItem): number =>
    task.data?.due ? (parseStoredDate(task.data.due)?.date.getTime() ?? 0) : 0;
  const byTime = (a: TaskItem, b: TaskItem) =>
    timeValue(a) - timeValue(b) || a.name.localeCompare(b.name);
  return [
    ...items.filter((task) => !isDone(task)).sort(byTime),
    ...items.filter(isDone).sort(byTime),
  ];
}

/* ------------------------------------------------------------- header */

/** The shared top block: period strip and the mode pills. */
function PlannerHeader({
  mode,
  selected,
  today,
  tasks,
  onSelect,
  onMode,
}: {
  mode: Mode;
  selected: Date;
  today: Date;
  tasks: TaskItem[];
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
        tasks={tasks}
        onSelect={onSelect}
      />

      {/* E's economy: the toggle pills lead the header block. */}
      <View style={styles.segmented}>
        {(["day", "week", "month"] as Mode[]).map((option) => (
          <Pressable
            key={option}
            style={({ pressed }) => [
              styles.segment,
              mode === option && styles.segmentActive,
              pressed && styles.pressedFill,
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
        ]}
        onHoverIn={() => setHover(true)}
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

/** Round-1 tray pills, back as draggable chips for the week foot. */
function UnscheduledPills({
  tasks,
  onDragStart,
}: {
  tasks: TaskItem[];
  onDragStart: (task: TaskItem, e: RNPointerEvent) => void;
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
          onPointerDown={(e) => onDragStart(task, e)}
        >
          <View style={styles.pillGrip}>
            <View style={styles.pillGripDot} />
            <View style={styles.pillGripDot} />
          </View>
          <Text style={styles.pillText} numberOfLines={1}>
            {task.name}
          </Text>
        </View>
      ))}
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
  onMode,
  onSelectStrip,
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
  onMode: (mode: Mode) => void;
  onSelectStrip: (date: Date) => void;
  onToggle: (task: TaskItem) => void;
  onUpdate: (task: TaskItem, patch: Partial<TaskFrontmatter>) => void;
}) {
  const [rootHeight, setRootHeight] = React.useState(0);
  const [rootX, setRootX] = React.useState(0);
  const [timelineHeight, setTimelineHeight] = React.useState(320);
  // A press waiting to travel: promoted to a drag past the threshold.
  const [pending, setPending] = React.useState<{
    task: TaskItem;
    x: number;
    y: number;
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

  // The list pane's rows follow the chosen source.
  const listRows =
    source === "due-period"
      ? dayTasks
      : sortOpenFirst(tasks.filter((task) => inSourceList(task, source)));

  const maxTimeline = Math.max(rootHeight - drag.minPane, drag.minPane);

  const startTaskDrag = (task: TaskItem, e: RNPointerEvent) => {
    moved.current = false;
    setPending({ task, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
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
    if (resizing) {
      const grown = resizing.height + (y - resizing.y);
      setTimelineHeight(
        Math.min(Math.max(grown, drag.minPane), Math.max(maxTimeline, drag.minPane)),
      );
      return;
    }
    if (pending) {
      const travel = Math.abs(x - pending.x) + Math.abs(y - pending.y);
      if (travel > drag.threshold) {
        moved.current = true;
        setDragging({ task: pending.task, x, y });
        setPending(null);
      }
      return;
    }
    if (dragging) {
      setDragging({ ...dragging, x, y });
    }
  };

  const onPointerUp = () => {
    if (resizing) {
      setResizing(null);
      return;
    }
    if (dragging) {
      if (hoverHour != null) {
        onUpdate(dragging.task, { due: withTime(date, hoverHour) });
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
      style={styles.dayRoot}
      onLayout={(e) => {
        setRootHeight(e.nativeEvent.layout.height);
        setRootX(e.nativeEvent.layout.x);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <PlannerHeader
        mode="day"
        selected={date}
        today={today}
        tasks={openTasks}
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
      <View style={[styles.pane, { height: timelineHeight }]}>
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
            onHoverSlot={setHoverHour}
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
            (grabHot || pressed) && styles.grabberHitHot,
          ]}
          onHoverIn={() => setGrabHot(true)}
          onHoverOut={() => setGrabHot(false)}
          onPointerDown={(e) => {
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

      {/* The task list pane: its source picks the rows. Dragging a
          row up into the ruler sets its time. */}
      <View style={styles.paneList}>
        <SourceToggle
          source={source}
          mode="day"
          menuOpen={sourceMenuOpen}
          onCycle={onCycleSource}
          onOpenMenu={onOpenSourceMenu}
        />
        <ScrollView
          style={styles.paneScroll}
          showsVerticalScrollIndicator={false}
        >
          {source === "due-period" && overdue.length > 0 ? (
            <View style={styles.overdueBlock}>
              <Text style={styles.overdueLabel}>Overdue  {overdue.length}</Text>
              {overdue.map((task) => (
                <View
                  key={task.uri}
                  onPointerDown={(e) => startTaskDrag(task, e)}
                >
                  <TaskRow task={task} onToggle={guardedToggle} />
                </View>
              ))}
            </View>
          ) : null}
          {listRows.length > 0 ? (
            listRows.map((task, index) => (
              <View
                key={task.uri}
                style={index > 0 ? styles.groupRow : undefined}
                onPointerDown={(e) => startTaskDrag(task, e)}
              >
                <TaskRow task={task} onToggle={guardedToggle} />
              </View>
            ))
          ) : (
            <Text style={styles.empty}>
              {source === "due-period"
                ? "Nothing scheduled today."
                : `Nothing on ${source} yet.`}
            </Text>
          )}
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
  onHoverSlot,
  onToggle,
  onDragStart,
}: {
  tasks: TaskItem[];
  isToday: boolean;
  now: Date;
  dragActive: boolean;
  hoverHour: number | null;
  onHoverSlot: (hour: number | null) => void;
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
    <View style={styles.ruler} onPointerLeave={() => onHoverSlot(null)}>
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
            style={[
              styles.rulerRow,
              dragActive && hoverHour === hour && styles.rulerRowHover,
            ]}
            onPointerEnter={() => {
              if (dragActive) {
                onHoverSlot(hour);
              }
            }}
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
  dragActive,
  hoveredDay,
  onHoverDay,
}: {
  tasks: TaskItem[];
  today: Date;
  selected: Date;
  onSelect: (date: Date) => void;
  dragActive: boolean;
  hoveredDay: Date | null;
  onHoverDay: (day: Date | null) => void;
}) {
  const todayStart = startOfDay(today).getTime();
  // The strip picks the week; its seven columns start on Sunday.
  const weekStart = startOfWeek(selected);
  const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(weekStart, offset));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
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
            onPress={() => onSelect(day)}
            onPointerEnter={() => {
              if (dragActive) {
                onHoverDay(day);
              }
            }}
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
                <View key={task.uri} style={styles.weekTask}>
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
  onToggle,
  onOpenDay,
  dragActive,
  hoveredDay,
  onHoverDay,
  onDragTask,
}: {
  viewMonth: Date;
  today: Date;
  tasks: TaskItem[];
  source: Source;
  onCycleSource: () => void;
  onOpenSourceMenu: (anchor: { top: number; left: number }) => void;
  sourceMenuOpen: boolean;
  onToggle: (task: TaskItem) => void;
  onOpenDay: (day: Date) => void;
  dragActive: boolean;
  hoveredDay: Date | null;
  onHoverDay: (day: Date | null) => void;
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
    }
    const iso = task.data.due.slice(0, 10);
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

  return (
    <View>
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
                onPress={() => setPicked({ key: monthKey, day })}
                onPointerEnter={() => {
                  if (dragActive) {
                    onHoverDay(day);
                  }
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
                {byDay.has(isoOf(day)) ? <View style={styles.monthDot} /> : null}
              </Pressable>
            ),
          )}
        </View>
      </View>

      {/* The list beneath the card, following the source. Its rows
          drag onto a day cell above to move their due date. */}
      <View style={styles.monthDayPanel}>
        <SourceToggle
          source={source}
          mode="month"
          menuOpen={sourceMenuOpen}
          onCycle={onCycleSource}
          onOpenMenu={onOpenSourceMenu}
        />
        {pickedTasks ? (
          <View style={styles.monthPickedBlock}>
            <Text style={styles.sectionLabel}>
              {WEEKDAYS_FULL[picked!.day.getDay()]} {picked!.day.getDate()}
              {"  "}
              {pickedTasks.length}
            </Text>
            {pickedTasks.length > 0 ? (
              pickedTasks.map((task) => (
                <View key={task.uri} onPointerDown={(e) => onDragTask(task, e)}>
                  <TaskRow task={task} onToggle={onToggle} />
                </View>
              ))
            ) : (
              <Text style={styles.monthDayEmpty}>Nothing scheduled.</Text>
            )}
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
          </View>
        ) : null}
        {listRows.length > 0 ? (
          listRows.map((task, index) => (
            <View
              key={task.uri}
              style={index > 0 ? styles.groupRow : undefined}
              onPointerDown={(e) => onDragTask(task, e)}
            >
              <TaskRow task={task} onToggle={onToggle} />
            </View>
          ))
        ) : (
          <Text style={styles.monthDayEmpty}>
            {source === "due-period"
              ? "Nothing scheduled this month."
              : `Nothing on ${source} yet.`}
          </Text>
        )}
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
 * The period strip above the pills. Day mode shows the seven days
 * from today; week mode shows the current week plus the upcoming
 * ones; month mode shows the current month plus the upcoming ones.
 * The current period is tinted, the selected period is filled, and a
 * tap jumps to it.
 */
function PeriodStrip({
  mode,
  selected,
  today,
  tasks,
  onSelect,
}: {
  mode: Mode;
  selected: Date;
  today: Date;
  tasks: TaskItem[];
  onSelect: (date: Date) => void;
}) {
  const todayStart = startOfDay(today).getTime();
  const selStart = startOfDay(selected).getTime();

  if (mode === "day") {
    const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(today, offset));
    const busy = new Set(
      tasks
        .map((task) => (task.data?.due ? parseStoredDate(task.data.due) : null))
        .filter((due) => due != null)
        .map((due) => isoOf(due!.date)),
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
                  !active && busy.has(isoOf(day)) ? styles.stripNumBusy : null,
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
    // The current week first, then the upcoming ones, one swipe away.
    // Cells match the day strip's size: a compact week shorthand.
    const weeks = Array.from({ length: 12 }, (_, index) =>
      startOfWeek(addDays(today, 7 * index)),
    );
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripScroll}
      >
        {weeks.map((weekStartDay) => {
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
        })}
      </ScrollView>
    );
  }

  // Month mode: the current month first, then the upcoming ones.
  // Cells mirror the day strip's anatomy: the year small on top, the
  // month word below it.
  const months = Array.from(
    { length: 12 },
    (_, index) =>
      new Date(today.getFullYear(), today.getMonth() + index, 1),
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stripScroll}
    >
      {months.map((monthStartDay) => {
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
      })}
    </ScrollView>
  );
}

function tasksForDay(tasks: TaskItem[], day: Date): TaskItem[] {
  const iso = isoOf(day);
  return tasks.filter(
    (task) =>
      task.data?.due != null &&
      task.data.due.slice(0, 10) === iso &&
      !(task.data?.completed != null && task.data.completed !== ""),
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
 * The due string a drop writes: the shown day at the slot's hour,
 * minutes zeroed. Dropping always schedules onto the day in view.
 */
function withTime(day: Date, hour: number): string {
  return formatLocal(
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0),
    true,
  );
}

function labelHour(hour: number): string {
  const h = hour % 12 || 12;
  return `${h} ${hour >= 12 ? "PM" : "AM"}`;
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
  },
  content: {
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    paddingHorizontal: 26,
    paddingTop: spacing.m,
    paddingBottom: spacing.xl,
  },
  pressedFill: {
    backgroundColor: colors.pressed,
  },

  // period strip: day cells, then the wider week and month cells
  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.s,
  },
  stripScroll: {
    flexDirection: "row",
    gap: spacing.s,
    // The same bottom spacing the day strip has, so the wide strips
    // never touch the pills.
    marginBottom: spacing.s,
    paddingRight: spacing.s,
  },
  stripDay: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 52,
    borderRadius: radius,
  },
  stripDayActive: {
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
  stripNumBusy: {
    fontWeight: "600",
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
    alignItems: "flex-start",
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
    paddingHorizontal: 26,
    paddingTop: spacing.m,
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

  // source toggle and its chooser menu
  sourceToggle: {
    flexDirection: "row",
    alignItems: "center" as const,
    alignSelf: "flex-start" as const,
    gap: spacing.xs,
    minHeight: 32,
    paddingLeft: spacing.s,
    paddingRight: spacing.s,
    borderRadius: radius,
    marginBottom: spacing.s,
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

  // week foot: round-1 tray pills, back as draggable chips
  pillsSection: {
    marginTop: spacing.m,
    marginBottom: spacing.xl,
  },
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
    paddingLeft: spacing.s,
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

  // week canvas: horizontally scrolling day columns
  weekCanvas: {
    flexDirection: "row",
    gap: spacing.s,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xl,
  },
  weekCol: {
    width: 176,
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
    marginBottom: spacing.xl,
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
