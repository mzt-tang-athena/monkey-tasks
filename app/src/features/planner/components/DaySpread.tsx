/* eslint-disable react-hooks/refs */
import * as React from "react";
import {
  Animated,
  ScrollView,
  Text,
  View,
  type PointerEvent as RNPointerEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { groupByDue, type TaskItem } from "../../tasks/query";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { TaskRow } from "../../../components/TaskRow";
import { makeSwipeController, swipeProps } from "../../../lib/swipe";
import { DropZoneMap } from "../../../lib/dropzone";
import { startOfDay } from "../../../lib/dates";
import { drag } from "../../../theme/tokens";
import type { TaskForm } from "../../../lib/settings";
import {
  hasTime,
  inSourceList,
  isoOf,
  minuteOf,
  sortOpenFirst,
  tasksForDayAll,
  withTime,
  type Mode,
  type Source,
} from "../model";
import { MONTHS, WEEKDAYS_FULL } from "../lib/labels";
import { useTouchDragGate, type PendingDrag } from "../hooks/useTouchDragGate";
import { Pickup, pointerPickup, type DragApi, type LiftState } from "./drag";
import { PlannerHeader } from "./PlannerHeader";
import { TaskListSection } from "./TaskListSection";
import { Timeline } from "./Timeline";
import { styles } from "./plannerStyles";

export function DaySpread({
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
  onOpen,
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
  /** A row body press opens the task; absent leaves the body inert. */
  onOpen?: (task: TaskItem) => void;
  onUpdate: (task: TaskItem, patch: Partial<TaskFrontmatter>) => void;
}) {
  const [rootHeight, setRootHeight] = React.useState(0);
  // The day root's page-space origin: the drag ghost lives inside it
  // but rides page coordinates from the gesture.
  const [rootPos, setRootPos] = React.useState({ x: 0, y: 0 });
  // The pane's top edge inside the root, measured at layout: the
  // divider may never travel past it plus a minimum list pane.
  const [paneTop, setPaneTop] = React.useState(200);
  const [timelineHeight, setTimelineHeight] = React.useState(320);
  // A press waiting to travel: promoted to a drag past the threshold.
  const [pending, setPending] = React.useState<PendingDrag | null>(null);
  // The hold cue: the finger is down on a row, then the row is armed
  // once the hold reaches its threshold. Native runs both; web reads
  // the same clock, so the preview shows what the phone shows.
  const [holding, setHolding] = React.useState<TaskItem | null>(null);
  const [armed, setArmed] = React.useState<TaskItem | null>(null);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = React.useState<{
    task: TaskItem;
  } | null>(null);
  // The ghost rides an Animated value, not state: a pointer move must
  // not re-render the whole spread.
  const [ghostX] = React.useState(() => new Animated.Value(0));
  const [ghostY] = React.useState(() => new Animated.Value(0));
  const [hoverHour, setHoverHour] = React.useState<number | null>(null);
  const [resizing, setResizing] = React.useState<{
    y: number;
    height: number;
  } | null>(null);
  const [grabHot, setGrabHot] = React.useState(false);
  const [grabbing, setGrabbing] = React.useState(false);
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
  // rects, since touch capture suppresses enter/leave events. The
  // hit band clips to the pane's visible area: scroll-folded rows
  // stretch nowhere.
  const [hourZones] = React.useState(() => new DropZoneMap());
  const paneRef = React.useRef<HTMLElement | null>(null);

  // DaySpread also gates scrolling while a drag or the grabber owns
  // the pointer, so the split resize survives on touch.
  // DaySpread also gates scrolling while a drag or the grabber owns
  // the pointer, so the split resize survives on touch. The gate
  // promotes the ruler pickup at the touchmove level, per the same
  // ordering rule as the screen root.
  const dayRootRef = React.useRef<HTMLElement | null>(null);
  const dayGate = React.useRef(false);
  const dayPendingRef = React.useRef(pending);
  React.useEffect(() => {
    dayPendingRef.current = pending;
  }, [pending]);
  React.useEffect(() => {
    dayGate.current = dragging != null || resizing != null;
  }, [dragging, resizing]);
  const promoteDayPending = React.useCallback((x: number, y: number) => {
    const pending = dayPendingRef.current;
    if (!pending || pending.task == null) {
      return;
    }
    moved.current = true;
    hourZones.measureAll(() => {
      const node = paneRef.current as unknown as {
        measureInWindow?: (cb: (px: number, py: number, pw: number, ph: number) => void) => void;
      } | null;
      if (node?.measureInWindow) {
        node.measureInWindow((px, py, pw, ph) => {
          hourZones.setClip({ x: px, y: py, w: pw, h: ph });
        });
      }
    });
    ghostX.setValue(x - rootPos.x - 100);
    ghostY.setValue(y - rootPos.y - 40);
    setDragging({ task: pending.task });
    setPending(null);
  }, [hourZones, ghostX, ghostY, rootPos]);
  useTouchDragGate(dayRootRef, {
    busy: dayGate,
    pending: dayPendingRef,
    promote: promoteDayPending,
  });
  const clearHoldTimer = React.useCallback(() => {
    if (holdTimer.current != null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);
  React.useEffect(() => clearHoldTimer, [clearHoldTimer]);
  const beginHold = React.useCallback(
    (task: TaskItem, kind: "pill" | "row") => {
      const wait = kind === "pill" ? drag.pillPickMs : drag.pickMs;
      setHolding(task);
      setArmed(null);
      clearHoldTimer();
      holdTimer.current = setTimeout(() => setArmed(task), wait);
    },
    [clearHoldTimer],
  );
  const endHold = React.useCallback(() => {
    clearHoldTimer();
    setHolding(null);
    setArmed(null);
  }, [clearHoldTimer]);

  // DaySpread's own lift: the source row tints through the hold and
  // lifts once the hold is armed or the drag owns the pointer.
  const lifted = React.useMemo<LiftState>(
    () =>
      dragging != null
        ? { task: dragging.task, phase: "picked" }
        : armed != null
          ? { task: armed, phase: "picked" }
          : pending != null
            ? { task: pending.task, phase: "hold" }
            : holding != null
              ? { task: holding, phase: "hold" }
              : null,
    [pending, dragging, holding, armed],
  );

  // The divider's travel limit: it may run until its bottom edge
  // touches the dayRoot's bottom edge - which is exactly where the
  // bottom bar begins - and never past it.
  const maxTimeline = Math.max(
    rootHeight - paneTop - dividerHeight,
    drag.minPane,
  );

  // Native drag sources drive the ruler machinery through here: the
  // hit band clips to the pane's visible area, and the drop writes
  // the slot's hour with the task's own minute.
  const draggingRef = React.useRef(dragging);
  const hoverHourRef = React.useRef(hoverHour);
  React.useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);
  React.useEffect(() => {
    hoverHourRef.current = hoverHour;
  }, [hoverHour]);
  const dayApi = React.useMemo<DragApi>(() => ({
    hold: beginHold,
    releaseHold: endHold,
    pickup: (task, x, y) => {
      endHold();
      // The hold already fired; a sideways drag must not also shift
      // the day when it ends.
      swipe.claim();
      moved.current = false;
      // Measure the pane's clip straight from its node: waiting for
      // measureAll's completion callback means one zone that never
      // calls back leaves the hour band unclipped for the whole drag.
      const pane = paneRef.current as unknown as {
        measureInWindow?: (cb: (px: number, py: number, pw: number, ph: number) => void) => void;
      } | null;
      if (pane?.measureInWindow) {
        pane.measureInWindow((px, py, pw, ph) => {
          hourZones.setClip({ x: px, y: py, w: pw, h: ph });
        });
      }
      hourZones.measureAll();
      ghostX.setValue(x - rootPos.x - 100);
      ghostY.setValue(y - rootPos.y - 40);
      setDragging({ task });
    },
    move: (x, y) => {
      ghostX.setValue(x - rootPos.x - 100);
      ghostY.setValue(y - rootPos.y - 40);
      const hit = hourZones.hit(x, y);
      const hour = hit?.startsWith("hour:") ? Number(hit.slice(5)) : null;
      if (hour !== hoverHourRef.current) {
        // The ref leads the state, so the drop reads this move's hour
        // even before React commits the hover.
        hoverHourRef.current = hour;
        setHoverHour(hour);
      }
    },
    drop: () => {
      const current = draggingRef.current;
      if (current && hoverHourRef.current != null) {
        onUpdate(current.task, {
          due: withTime(date, hoverHourRef.current, minuteOf(current.task)),
        });
      }
      // Only the web pointer path sees a click after the drop, so
      // only it arms the guard. A native tap must land.
      if (pointerPickup) {
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 350);
      }
      setDragging(null);
      setHoverHour(null);
    },
  }), [hourZones, date, onUpdate, swipe, beginHold, endHold, ghostX, ghostY, rootPos]);

  // The grabber's native resize: immediate activation, any travel
  // resizes the split.
  const grabStart = React.useRef<{ y: number; height: number } | null>(null);
  const timelineHeightRef = React.useRef(timelineHeight);
  React.useEffect(() => {
    timelineHeightRef.current = timelineHeight;
  }, [timelineHeight]);
  const grabberPan = React.useMemo(
    () =>
      Gesture.Pan()
        // Resizing reads refs and sets React state: JS thread only.
        .runOnJS(true)
        .minDistance(0)
        .onStart((e) => {
          // Resizing the split is not a swipe.
          swipe.claim();
          setGrabbing(true);
          grabStart.current = {
            y: e.absoluteY,
            height: timelineHeightRef.current,
          };
        })
        .onUpdate((e) => {
          const start = grabStart.current;
          if (!start) {
            return;
          }
          const grown = start.height + (e.absoluteY - start.y);
          setTimelineHeight(
            Math.min(
              Math.max(grown, drag.minPane),
              Math.max(maxTimeline, drag.minPane),
            ),
          );
        })
        .onEnd(() => {
          grabStart.current = null;
        })
        .onFinalize(() => {
          grabStart.current = null;
          setGrabbing(false);
        }),
    [maxTimeline, swipe],
  );

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

  const startTaskDrag = (
    task: TaskItem,
    e: RNPointerEvent,
    kind: "pill" | "row" = "row",
  ) => {
    moved.current = false;
    beginHold(task, kind);
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

  // The same guard for the body press: a drop is a drag, not an open.
  const guardedOpen =
    onOpen == null
      ? undefined
      : (task: TaskItem) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onOpen(task);
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
        // Same touch grammar as the screen root: hold first, then
        // movement is a drag no matter how far it jumps.
        if (performance.now() - pending.t < drag.pickMs) {
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
      hourZones.measureAll(() => {
        const node = paneRef.current as unknown as {
          measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
        } | null;
        if (node?.measureInWindow) {
          node.measureInWindow((x, y, w, h) => {
            hourZones.setClip({ x, y, w, h });
          });
        }
      });
      ghostX.setValue(x - rootPos.x - 100);
      ghostY.setValue(y - rootPos.y - 40);
      setDragging({ task: pending.task });
      setPending(null);
      return;
    }
    if (dragging) {
      ghostX.setValue(x - rootPos.x - 100);
      ghostY.setValue(y - rootPos.y - 40);
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
    endHold();
    moved.current = false;
  };

  const dayRoot = (
    <View
      ref={(node) => {
        dayRootRef.current = node as HTMLElement | null;
      }}
      style={styles.dayRoot}
      onLayout={(e) => {
        setRootHeight(e.nativeEvent.layout.height);
        // Layout x is parent relative and carries no y at all, so
        // the ghost's offsets come from a page-space measure.
        const node = dayRootRef.current as unknown as {
          measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
        } | null;
        node?.measureInWindow?.((x, y) => setRootPos({ x, y }));
      }}
      {...(pointerPickup
        ? {
            onPointerDown: (e: RNPointerEvent) => {
              // A fresh gesture clears drag-end suppression, like the
              // screen root does for its own drops.
              suppressClick.current = false;
              swipe.down(
                e.nativeEvent.pageX,
                e.nativeEvent.pageY,
                taskTouched.current,
              );
              taskTouched.current = false;
            },
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
          }
        : // Android gets no pointer events, so the same tripwire reads
          // the responder system there. A responder on the parent of a
          // scroller still sees the moves, which a gesture handler
          // would not.
          swipeProps(swipe))}
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
        ref={(node) => {
          paneRef.current = node as HTMLElement | null;
        }}
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
            lifted={lifted}
            onToggle={guardedToggle}
            onDragStart={startTaskDrag}
            api={dayApi}
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
        {(() => {
          // A plain View: a Pressable takes the responder and the
          // native pan then never sees the drag.
          const grabber = (
            <View
              style={[
                styles.grabberHit,
                (grabHot || grabbing || resizing != null) &&
                  styles.grabberHitHot,
              ]}
              accessibilityRole="button"
              accessibilityLabel="resize timeline"
              {...(pointerPickup
                ? {
                    onHoverIn: () => setGrabHot(true),
                    onHoverOut: () => setGrabHot(false),
                    onPointerDown: (e: RNPointerEvent) => {
                      // The grabber claims the gesture too: resizing
                      // must never fire a day swipe.
                      taskTouched.current = true;
                      setResizing({
                        y: e.nativeEvent.pageY,
                        height: timelineHeight,
                      });
                    },
                  }
                : {})}
            >
              <View
                style={[
                  styles.grabberBar,
                  (grabHot || grabbing || resizing != null || dragging != null) &&
                    styles.grabberBarActive,
                ]}
              />
            </View>
          );
          if (pointerPickup) {
            return grabber;
          }
          return (
            <GestureDetector gesture={grabberPan}>{grabber}</GestureDetector>
          );
        })()}
      </View>

      {/* The task list pane: the shared bottom-half section. Its
          source picks the rows; dragging a row up into the ruler
          sets its time. */}
      <View style={styles.paneList}>
        <TaskListSection
          style={styles.paneScroll}
          source={source}
          mode="day"
          sourceMenuOpen={sourceMenuOpen}
          onCycleSource={onCycleSource}
          onOpenSourceMenu={onOpenSourceMenu}
          taskForm={taskForm}
          onFormChange={onFormChange}
          onToggle={guardedToggle}
          onOpen={guardedOpen}
          onDragStart={startTaskDrag}
          tasks={sectionTasks}
          lifted={lifted}
          api={dayApi}
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
                  <Pickup
                    key={task.id}
                    task={task}
                    api={dayApi}
                    lifted={lifted ?? null}
                    onPointerDown={(e) => startTaskDrag(task, e)}
                  >
                    <TaskRow
                      task={task}
                      onToggle={guardedToggle}
                      onOpen={guardedOpen}
                    />
                  </Pickup>
                ))}
              </View>
            ) : undefined
          }
        />
      </View>

      {/* The drag ghost, riding just above the pointer. */}
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
    </View>
  );
  return dayRoot;
}

